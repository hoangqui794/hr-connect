#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_SCRIPT="$SCRIPT_DIR/deploy-render.sh"
readonly TEST_SHA='8ef754a92ab30422544f1fbcaf9af5b964c89688'

fail() {
  echo "TEST FAILED: $1" >&2
  exit 1
}

run_case() {
  local case_name="$1"
  local post_response="$2"
  local initial_list_calls="${3:-0}"
  local temp_dir
  temp_dir="$(mktemp -d)"

  mkdir -p "$temp_dir/bin"
  cat > "$temp_dir/bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -Eeuo pipefail

args="$*"
if [[ "$args" == *'/deploys/dep-test'* ]]; then
  printf '{"id":"dep-test","commit":{"id":"%s"},"status":"live"}\n' "$DEPLOY_SHA"
elif [[ "$args" == *'/deploys?limit=20'* ]]; then
  list_calls="$(cat "$MOCK_STATE_FILE" 2>/dev/null || printf '0')"
  list_calls="$((list_calls + 1))"
  printf '%s' "$list_calls" > "$MOCK_STATE_FILE"
  if (( list_calls == 1 )); then
    printf '[]\n'
  else
    printf '[{"deploy":{"id":"dep-test","commit":{"id":"%s"},"status":"queued"},"cursor":"next"}]\n' "$DEPLOY_SHA"
  fi
elif [[ "$args" == *'/deploys'* && "$args" == *'-X POST'* ]]; then
  [[ "$MOCK_POST_RESPONSE" != '__FAIL_IF_POSTED__' ]] \
    || { echo 'A duplicate deploy was triggered.' >&2; exit 3; }
  printf '%s' "$MOCK_POST_RESPONSE"
elif [[ "$args" == *'/health/ready'* ]]; then
  exit 0
else
  echo "Unexpected curl call: $args" >&2
  exit 2
fi
MOCK_CURL
  cat > "$temp_dir/bin/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
exit 0
MOCK_SLEEP
  chmod +x "$temp_dir/bin/curl" "$temp_dir/bin/sleep"
  printf '%s' "$initial_list_calls" > "$temp_dir/list-call-count"

  if ! PATH="$temp_dir/bin:$PATH" \
    RENDER_API_KEY='test-api-key' \
    RENDER_SERVICE_ID='srv-test' \
    RENDER_SERVICE_URL='https://example.onrender.com' \
    DEPLOY_SHA="$TEST_SHA" \
    CLEAR_CACHE='do_not_clear' \
    GITHUB_OUTPUT="$temp_dir/github-output" \
    MOCK_STATE_FILE="$temp_dir/list-call-count" \
    MOCK_POST_RESPONSE="$post_response" \
    bash -x "$DEPLOY_SCRIPT" > "$temp_dir/output.log" 2>&1; then
    cat "$temp_dir/output.log" >&2
    rm -rf "$temp_dir"
    fail "$case_name"
  fi

  grep -q '^deploy_id=dep-test$' "$temp_dir/github-output" \
    || fail "$case_name did not publish the deploy ID"
  grep -q '^status=live-and-healthy$' "$temp_dir/github-output" \
    || fail "$case_name did not finish healthy"

  rm -rf "$temp_dir"
  echo "PASS: $case_name"
}

bash -n "$DEPLOY_SCRIPT"
run_case '201 response with deploy ID' \
  "{\"id\":\"dep-test\",\"commit\":{\"id\":\"$TEST_SHA\"},\"status\":\"created\"}"
run_case '202 queued response without deploy ID' ''
run_case 'existing deploy for the same commit is reused' '__FAIL_IF_POSTED__' 1
