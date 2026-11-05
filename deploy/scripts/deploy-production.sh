#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/hrconnect/deploy}"
readonly RELEASES_DIR="$DEPLOY_ROOT/releases"
readonly STATE_DIR="$DEPLOY_ROOT/state"
readonly DATA_DIR="$DEPLOY_ROOT/data"
readonly CADDY_DIR="$DEPLOY_ROOT/caddy"
readonly CURRENT_LINK="$DEPLOY_ROOT/current"
readonly PREVIOUS_LINK="$DEPLOY_ROOT/previous"
readonly ACTIVE_COLOR_FILE="$STATE_DIR/active-color"
readonly AI_ACTIVE_COLOR_FILE="$DATA_DIR/ai-v2/active-color"
readonly DEPLOY_LOCK_FILE="$STATE_DIR/deploy.lock"
readonly CADDY_CONFIG="$CADDY_DIR/Caddyfile"
readonly CADDY_UPSTREAMS="$CADDY_DIR/active-upstreams.caddy"
readonly CADDY_SYSTEM_CONFIG="${CADDY_SYSTEM_CONFIG:-/etc/caddy/Caddyfile}"
readonly BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$DEPLOY_ROOT/env/backend.env}"
readonly AI_ENV_FILE="${AI_ENV_FILE:-$DEPLOY_ROOT/env/ai-v2.env}"
readonly HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-18}"
readonly HEALTH_DELAY_SECONDS="${HEALTH_DELAY_SECONDS:-10}"
readonly DRAIN_SECONDS="${DRAIN_SECONDS:-15}"
readonly PUBLIC_BACKEND_LIVE_URL="${PUBLIC_BACKEND_LIVE_URL:-https://api.hrconnectvn.online/health/live}"
readonly PUBLIC_BACKEND_READY_URL="${PUBLIC_BACKEND_READY_URL:-https://api.hrconnectvn.online/health/ready}"
readonly PUBLIC_AI_HEALTH_URL="${PUBLIC_AI_HEALTH_URL:-https://ai.hrconnectvn.online/health}"
readonly STOPPED_CONTAINER_RETENTION="${STOPPED_CONTAINER_RETENTION:-24h}"
readonly BUILDER_CACHE_RETENTION="${BUILDER_CACHE_RETENTION:-24h}"
readonly UNUSED_IMAGE_RETENTION="${UNUSED_IMAGE_RETENTION:-168h}"
readonly DISK_WARNING_PERCENT="${DISK_WARNING_PERCENT:-75}"
readonly MEMORY_WARNING_PERCENT="${MEMORY_WARNING_PERCENT:-85}"

fail() {
  echo "DEPLOYMENT FAILED: $1" >&2
  return 1
}

require_file() {
  [[ -f "$1" ]] || fail "Required file does not exist: $1"
}

color_backend_port() {
  [[ "$1" == 'blue' ]] && printf '18080\n' || printf '28080\n'
}

color_ai_port() {
  [[ "$1" == 'blue' ]] && printf '18001\n' || printf '28001\n'
}

other_color() {
  [[ "$1" == 'blue' ]] && printf 'green\n' || printf 'blue\n'
}

compose_color() {
  local release_dir="$1"
  local color="$2"
  shift 2
  docker compose \
    --project-name "hrconnect-$color" \
    --env-file "$release_dir/release.env" \
    --file "$release_dir/compose.prod.yml" \
    "$@"
}

write_release_env() {
  local release_dir="$1"
  local color="$2"
  local backend_image="$3"
  local ai_image="$4"
  umask 077
  {
    printf 'DEPLOY_COLOR=%s\n' "$color"
    printf 'BACKEND_HOST_PORT=%s\n' "$(color_backend_port "$color")"
    printf 'AI_HOST_PORT=%s\n' "$(color_ai_port "$color")"
    printf 'BACKEND_IMAGE=%s\n' "$backend_image"
    printf 'AI_IMAGE=%s\n' "$ai_image"
    printf 'BACKEND_ENV_FILE=%s\n' "$BACKEND_ENV_FILE"
    printf 'AI_ENV_FILE=%s\n' "$AI_ENV_FILE"
    printf 'AI_DATA_DIR=%s\n' "$DATA_DIR/ai-v2"
  } > "$release_dir/release.env"
}

wait_for_url() {
  local label="$1"
  local url="$2"
  for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do
    if curl --silent --show-error --fail --connect-timeout 5 --max-time 15 "$url" > /dev/null; then
      echo "Healthy: $label"
      return 0
    fi
    echo "Health check failed for $label ($attempt/$HEALTH_ATTEMPTS)."
    (( attempt < HEALTH_ATTEMPTS )) && sleep "$HEALTH_DELAY_SECONDS"
  done
  return 1
}

wait_for_color() {
  local color="$1"
  wait_for_url "Backend $color live" "http://127.0.0.1:$(color_backend_port "$color")/health/live" \
    && wait_for_url "Backend $color ready" "http://127.0.0.1:$(color_backend_port "$color")/health/ready" \
    && wait_for_url "AI v2 $color" "http://127.0.0.1:$(color_ai_port "$color")/health"
}

wait_for_worker_state() {
  local color="$1"
  local expected="$2"
  local expected_json='false'
  [[ "$expected" == 'active' ]] && expected_json='true'
  local url="http://127.0.0.1:$(color_ai_port "$color")/health/worker"
  local response=''
  for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do
    response="$(curl --silent --show-error --fail --connect-timeout 5 --max-time 15 "$url" || true)"
    if grep -q "\"workersActive\":$expected_json" <<< "$response"; then
      echo "AI worker $color is $expected."
      return 0
    fi
    echo "Waiting for AI worker $color to become $expected ($attempt/$HEALTH_ATTEMPTS)."
    (( attempt < HEALTH_ATTEMPTS )) && sleep "$HEALTH_DELAY_SECONDS"
  done
  return 1
}

wait_for_public_stack() {
  wait_for_url 'Public Backend live' "$PUBLIC_BACKEND_LIVE_URL" \
    && wait_for_url 'Public Backend ready' "$PUBLIC_BACKEND_READY_URL" \
    && wait_for_url 'Public AI v2' "$PUBLIC_AI_HEALTH_URL"
}

write_upstreams() {
  local destination="$1"
  local backend_port="$2"
  local ai_port="$3"
  umask 022
  cat > "$destination" <<EOF
(backend_upstream) {
    reverse_proxy 127.0.0.1:$backend_port
}

(ai_v2_upstream) {
    reverse_proxy 127.0.0.1:$ai_port
}
EOF
}

reload_caddy() {
  caddy reload --config "$CADDY_CONFIG" --adapter caddyfile 2>/dev/null \
    || sudo -n systemctl reload caddy
}

activate_color() {
  local color="$1"
  local candidate="$STATE_DIR/active-upstreams.$DEPLOY_SHA.candidate"
  write_upstreams "$candidate" "$(color_backend_port "$color")" "$(color_ai_port "$color")"
  mv -f "$candidate" "$CADDY_UPSTREAMS"
  caddy validate --config "$CADDY_CONFIG" --adapter caddyfile
  reload_caddy
}

restore_caddy() {
  local config_backup="$1"
  local upstream_backup="$2"
  [[ -f "$config_backup" ]] && cp -f "$config_backup" "$CADDY_CONFIG"
  [[ -f "$upstream_backup" ]] && cp -f "$upstream_backup" "$CADDY_UPSTREAMS"
  caddy validate --config "$CADDY_CONFIG" --adapter caddyfile
  reload_caddy
}

stop_color() {
  local release_dir="$1"
  local color="$2"
  [[ -n "$release_dir" && -f "$release_dir/compose.prod.yml" && -f "$release_dir/release.env" ]] || return 0
  compose_color "$release_dir" "$color" down --remove-orphans || true
}

resource_usage_percent() {
  case "$1" in
    disk) df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }' ;;
    memory) awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END {if (t>0) printf "%d\n", ((t-a)*100)/t}' /proc/meminfo ;;
    *) return 1 ;;
  esac
}

report_resource_usage() {
  local disk_percent memory_percent
  disk_percent="$(resource_usage_percent disk 2>/dev/null || true)"
  memory_percent="$(resource_usage_percent memory 2>/dev/null || true)"
  echo "Host resources: disk=${disk_percent:-unknown}% memory=${memory_percent:-unknown}%"
  docker stats --no-stream --format 'Container {{.Name}}: memory={{.MemUsage}} cpu={{.CPUPerc}}' 2>/dev/null || true
  [[ "$disk_percent" =~ ^[0-9]+$ ]] && (( disk_percent >= DISK_WARNING_PERCENT )) \
    && echo "WARNING: root disk usage is ${disk_percent}% (threshold ${DISK_WARNING_PERCENT}%)." >&2
  [[ "$memory_percent" =~ ^[0-9]+$ ]] && (( memory_percent >= MEMORY_WARNING_PERCENT )) \
    && echo "WARNING: host memory usage is ${memory_percent}% (threshold ${MEMORY_WARNING_PERCENT}%)." >&2
  return 0
}

cleanup_after_successful_deploy() {
  echo 'Cleaning unused Docker resources after successful health checks...'
  docker container prune --force --filter "until=$STOPPED_CONTAINER_RETENTION" > /dev/null \
    || echo 'WARNING: unable to prune stopped containers.' >&2
  docker image prune --all --force --filter "until=$UNUSED_IMAGE_RETENTION" > /dev/null \
    || echo 'WARNING: unable to prune unused images.' >&2
  docker builder prune --force --filter "until=$BUILDER_CACHE_RETENTION" > /dev/null \
    || echo 'WARNING: unable to prune Docker build cache.' >&2
  report_resource_usage
}

atomic_write() {
  local value="$1"
  local destination="$2"
  printf '%s\n' "$value" > "$destination.tmp"
  mv -f "$destination.tmp" "$destination"
}

[[ "${DEPLOY_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail 'DEPLOY_SHA must be a complete lowercase 40-character commit SHA.'
[[ "${BACKEND_IMAGE:-}" =~ ^ghcr\.io/[a-z0-9._/-]+:sha-[0-9a-f]{40}$ ]] || fail 'BACKEND_IMAGE must be an immutable GHCR sha tag.'
[[ "${AI_IMAGE:-}" =~ ^ghcr\.io/[a-z0-9._/-]+:sha-[0-9a-f]{40}$ ]] || fail 'AI_IMAGE must be an immutable GHCR sha tag.'
[[ "$BACKEND_IMAGE" == *":sha-$DEPLOY_SHA" ]] || fail 'BACKEND_IMAGE does not match DEPLOY_SHA.'
[[ "$AI_IMAGE" == *":sha-$DEPLOY_SHA" ]] || fail 'AI_IMAGE does not match DEPLOY_SHA.'

readonly RELEASE_DIR="$RELEASES_DIR/$DEPLOY_SHA"
readonly COMPOSE_FILE="$RELEASE_DIR/compose.prod.yml"
readonly RELEASE_CADDYFILE="$RELEASE_DIR/Caddyfile"
require_file "$COMPOSE_FILE"
require_file "$RELEASE_CADDYFILE"
require_file "$BACKEND_ENV_FILE"
require_file "$AI_ENV_FILE"
for command_name in docker curl caddy flock; do
  command -v "$command_name" > /dev/null || fail "$command_name is not installed."
done
docker compose version > /dev/null || fail 'Docker Compose is not available.'

mkdir -p "$RELEASES_DIR" "$STATE_DIR" "$DATA_DIR/ai-v2" "$CADDY_DIR"
chmod 700 "$STATE_DIR"
chmod 750 "$DATA_DIR" "$DATA_DIR/ai-v2"
exec 9>"$DEPLOY_LOCK_FILE"
flock -n 9 || fail 'Another production deployment is already running.'

active_color='legacy'
if [[ -f "$ACTIVE_COLOR_FILE" ]]; then
  active_color="$(tr -d '[:space:]' < "$ACTIVE_COLOR_FILE")"
  [[ "$active_color" == 'blue' || "$active_color" == 'green' ]] || fail "Invalid active color state: $active_color"
fi
target_color='blue'
[[ "$active_color" == 'blue' ]] && target_color="$(other_color "$active_color")"
previous_dir=''
[[ -L "$CURRENT_LINK" ]] && previous_dir="$(readlink -f "$CURRENT_LINK")"

write_release_env "$RELEASE_DIR" "$target_color" "$BACKEND_IMAGE" "$AI_IMAGE"
compose_color "$RELEASE_DIR" "$target_color" config --quiet
echo "Pulling immutable images for commit $DEPLOY_SHA into inactive color $target_color..."
compose_color "$RELEASE_DIR" "$target_color" pull || fail 'Unable to pull one or more production images.'

echo 'Running the one-shot database migration before traffic switch...'
compose_color "$RELEASE_DIR" "$target_color" run --rm --no-deps backend --migrate \
  || fail 'Database migration failed; active color was not changed.'

echo "Starting inactive color $target_color..."
if ! compose_color "$RELEASE_DIR" "$target_color" up -d --remove-orphans || ! wait_for_color "$target_color"; then
  stop_color "$RELEASE_DIR" "$target_color"
  fail "Inactive color $target_color did not become healthy; active color remains $active_color."
  exit 1
fi

# The API can be healthy while inactive, but only the elected color may accept/process scoring jobs.
# A handoff marker first drains/cancels the old worker before the new worker reads the shared queue.
if [[ "$active_color" == 'blue' || "$active_color" == 'green' ]]; then
  echo "Pausing AI workers before handing the persistent queue to $target_color..."
  atomic_write 'handoff' "$AI_ACTIVE_COLOR_FILE"
  if ! wait_for_worker_state "$active_color" inactive \
    || ! wait_for_worker_state "$target_color" inactive; then
    echo "AI queue handoff failed; restoring worker ownership to $active_color." >&2
    atomic_write "$active_color" "$AI_ACTIVE_COLOR_FILE"
    wait_for_worker_state "$active_color" active || true
    stop_color "$RELEASE_DIR" "$target_color"
    fail "AI workers did not enter a safe handoff state; active color remains $active_color."
    exit 1
  fi
fi
atomic_write "$target_color" "$AI_ACTIVE_COLOR_FILE"
if ! wait_for_worker_state "$target_color" active; then
  if [[ "$active_color" == 'blue' || "$active_color" == 'green' ]]; then
    atomic_write "$active_color" "$AI_ACTIVE_COLOR_FILE"
    wait_for_worker_state "$active_color" active || true
  else
    rm -f "$AI_ACTIVE_COLOR_FILE"
  fi
  stop_color "$RELEASE_DIR" "$target_color"
  fail "Target AI worker $target_color did not acquire the persistent queue."
  exit 1
fi

readonly CADDY_CONFIG_BACKUP="$STATE_DIR/Caddyfile.before-$DEPLOY_SHA"
readonly CADDY_UPSTREAMS_BACKUP="$STATE_DIR/active-upstreams.before-$DEPLOY_SHA"
[[ -f "$CADDY_CONFIG" ]] && cp -f "$CADDY_CONFIG" "$CADDY_CONFIG_BACKUP"
if [[ -f "$CADDY_UPSTREAMS" ]]; then
  cp -f "$CADDY_UPSTREAMS" "$CADDY_UPSTREAMS_BACKUP"
else
  write_upstreams "$CADDY_UPSTREAMS_BACKUP" 8080 8001
fi
cp -f "$RELEASE_CADDYFILE" "$CADDY_CONFIG.new"
mv -f "$CADDY_CONFIG.new" "$CADDY_CONFIG"

resolved_system_config="$(readlink -f "$CADDY_SYSTEM_CONFIG" 2>/dev/null || true)"
resolved_managed_config="$(readlink -f "$CADDY_CONFIG")"
if [[ "$resolved_system_config" != "$resolved_managed_config" ]]; then
  restore_caddy "$CADDY_CONFIG_BACKUP" "$CADDY_UPSTREAMS_BACKUP" || true
  if [[ "$active_color" == 'blue' || "$active_color" == 'green' ]]; then
    atomic_write "$active_color" "$AI_ACTIVE_COLOR_FILE"
    wait_for_worker_state "$active_color" active || true
  else
    rm -f "$AI_ACTIVE_COLOR_FILE"
  fi
  stop_color "$RELEASE_DIR" "$target_color"
  fail "$CADDY_SYSTEM_CONFIG must be a symlink to $CADDY_CONFIG before automated blue-green deployment."
  exit 1
fi

echo "Switching Caddy atomically to $target_color..."
if ! activate_color "$target_color" || ! wait_for_public_stack; then
  echo 'Post-switch smoke check failed; restoring the previous Caddy upstreams.' >&2
  restore_caddy "$CADDY_CONFIG_BACKUP" "$CADDY_UPSTREAMS_BACKUP" || true
  if [[ "$active_color" == 'blue' || "$active_color" == 'green' ]]; then
    atomic_write "$active_color" "$AI_ACTIVE_COLOR_FILE"
    wait_for_worker_state "$active_color" active || true
  else
    atomic_write 'handoff' "$AI_ACTIVE_COLOR_FILE"
  fi
  wait_for_public_stack || true
  stop_color "$RELEASE_DIR" "$target_color"
  fail "Traffic rollback completed; active color remains $active_color."
  exit 1
fi

if [[ -n "$previous_dir" && "$previous_dir" != "$RELEASE_DIR" ]]; then
  ln -sfn "$previous_dir" "$PREVIOUS_LINK"
fi
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
atomic_write "$target_color" "$ACTIVE_COLOR_FILE"
if (( DRAIN_SECONDS > 0 )); then
  echo "Draining the previous color for ${DRAIN_SECONDS}s..."
  sleep "$DRAIN_SECONDS"
fi

if [[ "$active_color" == 'blue' || "$active_color" == 'green' ]]; then
  stop_color "$previous_dir" "$active_color"
elif [[ "$active_color" == 'legacy' ]]; then
  docker stop hrconnect-backend hrconnect-ai-v2 > /dev/null 2>&1 || true
fi

rm -f "$CADDY_CONFIG_BACKUP" "$CADDY_UPSTREAMS_BACKUP"
cleanup_after_successful_deploy
echo "Deployment succeeded: $DEPLOY_SHA ($target_color is active)"
