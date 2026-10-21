#!/usr/bin/env bash
set -Eeuo pipefail

readonly RENDER_API_BASE='https://api.render.com/v1'
readonly POLL_INTERVAL_SECONDS=20
readonly MAX_WAIT_SECONDS=1200

fail() {
  echo "::error::$1" >&2
  exit 1
}

write_output() {
  local key="$1"
  local value="$2"
  printf '%s=%s\n' "$key" "$value" >> "$GITHUB_OUTPUT"
}

render_api() {
  curl \
    --silent \
    --show-error \
    --fail-with-body \
    --retry 5 \
    --retry-delay 5 \
    --retry-all-errors \
    --connect-timeout 15 \
    --max-time 60 \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    "$@"
}

[[ -n "${RENDER_API_KEY:-}" ]] || fail 'Missing required GitHub secret RENDER_API_KEY.'
[[ "${RENDER_SERVICE_ID:-}" == srv-* ]] || fail 'RENDER_SERVICE_ID must be the Render service ID beginning with srv-.'
[[ "${DEPLOY_SHA:-}" =~ ^[0-9a-fA-F]{40}$ ]] || fail 'DEPLOY_SHA must be a complete 40-character Git commit SHA.'
[[ "${CLEAR_CACHE:-do_not_clear}" == 'clear' || "${CLEAR_CACHE:-do_not_clear}" == 'do_not_clear' ]] \
  || fail 'CLEAR_CACHE must be clear or do_not_clear.'

readonly dashboard_url="https://dashboard.render.com/web/$RENDER_SERVICE_ID"
readonly service_url="${RENDER_SERVICE_URL%/}"
readonly healthcheck_url="${RENDER_HEALTHCHECK_URL:-$service_url/health/ready}"

write_output dashboard_url "$dashboard_url"
write_output service_url "$service_url"
write_output status 'triggering'

echo "Triggering Render deployment for commit $DEPLOY_SHA..."
payload="$(jq -cn \
  --arg commitId "$DEPLOY_SHA" \
  --arg clearCache "${CLEAR_CACHE:-do_not_clear}" \
  '{commitId: $commitId, clearCache: $clearCache, deployMode: "build_and_deploy"}')"

response="$(render_api \
  -X POST \
  -H 'Content-Type: application/json' \
  --data "$payload" \
  "$RENDER_API_BASE/services/$RENDER_SERVICE_ID/deploys")"

deploy_id="$(jq -er '.id' <<< "$response")" || fail "Render did not return a deploy ID: $response"
returned_commit="$(jq -r '.commit.id // empty' <<< "$response")"

[[ -z "$returned_commit" || "$returned_commit" == "$DEPLOY_SHA" ]] \
  || fail "Render queued commit $returned_commit instead of requested commit $DEPLOY_SHA."

write_output deploy_id "$deploy_id"
echo "Render deploy ID: $deploy_id"
echo "Follow progress: $dashboard_url"

started_at="$(date +%s)"
last_status='created'

while true; do
  elapsed="$(( $(date +%s) - started_at ))"
  if (( elapsed >= MAX_WAIT_SECONDS )); then
    fail "Render deployment timed out after ${MAX_WAIT_SECONDS}s. Last status: $last_status. Dashboard: $dashboard_url"
  fi

  sleep "$POLL_INTERVAL_SECONDS"
  response="$(render_api "$RENDER_API_BASE/services/$RENDER_SERVICE_ID/deploys/$deploy_id")"
  status="$(jq -er '.status' <<< "$response")" || fail "Render returned an invalid deployment response: $response"

  if [[ "$status" != "$last_status" ]]; then
    echo "[$elapsed s] Render status: $status"
    last_status="$status"
    write_output status "$status"
  fi

  case "$status" in
    live)
      deployed_commit="$(jq -r '.commit.id // empty' <<< "$response")"
      [[ "$deployed_commit" == "$DEPLOY_SHA" ]] \
        || fail "Render marked a different commit live: ${deployed_commit:-unknown}. Expected: $DEPLOY_SHA."
      break
      ;;
    build_failed|update_failed|pre_deploy_failed|deactivated|canceled)
      finished_at="$(jq -r '.finishedAt // "unknown"' <<< "$response")"
      fail "Render deployment failed with status $status at $finished_at. Dashboard: $dashboard_url"
      ;;
    created|queued|build_in_progress|pre_deploy_in_progress|update_in_progress)
      ;;
    *)
      fail "Render returned an unsupported deployment status: $status"
      ;;
  esac
done

echo "Render reports commit $DEPLOY_SHA as live. Verifying health endpoint..."
healthy=false
for attempt in {1..12}; do
  if curl \
    --silent \
    --show-error \
    --fail \
    --location \
    --connect-timeout 10 \
    --max-time 30 \
    "$healthcheck_url" > /dev/null; then
    healthy=true
    break
  fi
  echo "Health check attempt $attempt/12 failed; retrying in 10 seconds..."
  sleep 10
done

[[ "$healthy" == true ]] || fail "Deployment is live but health check failed: $healthcheck_url"

write_output status 'live-and-healthy'
echo "Deployment verified: $service_url"
