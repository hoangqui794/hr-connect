#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/hrconnect/deploy}"
readonly RELEASES_DIR="$DEPLOY_ROOT/releases"
readonly CURRENT_LINK="$DEPLOY_ROOT/current"
readonly PREVIOUS_LINK="$DEPLOY_ROOT/previous"
readonly BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$DEPLOY_ROOT/env/backend.env}"
readonly AI_ENV_FILE="${AI_ENV_FILE:-$DEPLOY_ROOT/env/ai-v2.env}"
readonly HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-18}"
readonly HEALTH_DELAY_SECONDS="${HEALTH_DELAY_SECONDS:-10}"
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

compose() {
  local release_dir="$1"
  shift
  docker compose \
    --project-name hrconnect \
    --env-file "$release_dir/release.env" \
    --file "$release_dir/compose.prod.yml" \
    "$@"
}

write_release_env() {
  local release_dir="$1"
  local backend_image="$2"
  local ai_image="$3"

  umask 077
  {
    printf 'BACKEND_IMAGE=%s\n' "$backend_image"
    printf 'AI_IMAGE=%s\n' "$ai_image"
    printf 'BACKEND_ENV_FILE=%s\n' "$BACKEND_ENV_FILE"
    printf 'AI_ENV_FILE=%s\n' "$AI_ENV_FILE"
  } > "$release_dir/release.env"
}

wait_for_url() {
  local label="$1"
  local url="$2"

  for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do
    if curl \
      --silent \
      --show-error \
      --fail \
      --connect-timeout 5 \
      --max-time 15 \
      "$url" > /dev/null; then
      echo "Healthy: $label"
      return 0
    fi

    echo "Health check failed for $label ($attempt/$HEALTH_ATTEMPTS)."
    if (( attempt < HEALTH_ATTEMPTS )); then
      sleep "$HEALTH_DELAY_SECONDS"
    fi
  done

  return 1
}

wait_for_stack() {
  wait_for_url 'Backend live' 'http://127.0.0.1:8080/health/live' \
    && wait_for_url 'Backend ready' 'http://127.0.0.1:8080/health/ready' \
    && wait_for_url 'AI v2' 'http://127.0.0.1:8001/health'
}

resource_usage_percent() {
  local kind="$1"

  case "$kind" in
    disk)
      df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }'
      ;;
    memory)
      awk '
        /MemTotal:/ { total = $2 }
        /MemAvailable:/ { available = $2 }
        END {
          if (total > 0) {
            printf "%d\n", ((total - available) * 100) / total
          }
        }
      ' /proc/meminfo
      ;;
    *)
      return 1
      ;;
  esac
}

report_resource_usage() {
  local disk_percent
  local memory_percent
  disk_percent="$(resource_usage_percent disk 2>/dev/null || true)"
  memory_percent="$(resource_usage_percent memory 2>/dev/null || true)"

  echo "Host resources: disk=${disk_percent:-unknown}% memory=${memory_percent:-unknown}%"
  docker stats --no-stream \
    --format 'Container {{.Name}}: memory={{.MemUsage}} cpu={{.CPUPerc}}' \
    hrconnect-backend hrconnect-ai-v2 2>/dev/null || true

  if [[ "$disk_percent" =~ ^[0-9]+$ ]] && (( disk_percent >= DISK_WARNING_PERCENT )); then
    echo "WARNING: root disk usage is ${disk_percent}% (threshold ${DISK_WARNING_PERCENT}%)." >&2
  fi

  if [[ "$memory_percent" =~ ^[0-9]+$ ]] && (( memory_percent >= MEMORY_WARNING_PERCENT )); then
    echo "WARNING: host memory usage is ${memory_percent}% (threshold ${MEMORY_WARNING_PERCENT}%)." >&2
  fi
}

cleanup_after_successful_deploy() {
  echo 'Cleaning unused Docker resources after successful health checks...'

  docker container prune --force \
    --filter "until=$STOPPED_CONTAINER_RETENTION" > /dev/null \
    || echo 'WARNING: unable to prune stopped containers.' >&2

  # Remove only unused images. Active container images are never selected and
  # volumes are deliberately excluded. A missing rollback image can still be
  # pulled again from its immutable GHCR sha tag.
  docker image prune --all --force \
    --filter "until=$UNUSED_IMAGE_RETENTION" > /dev/null \
    || echo 'WARNING: unable to prune unused images.' >&2

  docker builder prune --force \
    --filter "until=$BUILDER_CACHE_RETENTION" > /dev/null \
    || echo 'WARNING: unable to prune Docker build cache.' >&2

  report_resource_usage
}

bootstrap_current_release() {
  [[ -L "$CURRENT_LINK" ]] && return 0

  local backend_image
  local ai_image
  backend_image="$(docker inspect --format='{{.Config.Image}}' hrconnect-backend 2>/dev/null || true)"
  ai_image="$(docker inspect --format='{{.Config.Image}}' hrconnect-ai-v2 2>/dev/null || true)"

  if [[ -z "$backend_image" || -z "$ai_image" ]]; then
    echo 'No existing deployment was found; this will be the first managed release.'
    return 0
  fi

  local bootstrap_dir="$RELEASES_DIR/bootstrap"
  mkdir -p "$bootstrap_dir"
  cp "$RELEASE_DIR/compose.prod.yml" "$bootstrap_dir/compose.prod.yml"
  write_release_env "$bootstrap_dir" "$backend_image" "$ai_image"
  ln -sfn "$bootstrap_dir" "$CURRENT_LINK"
  echo "Captured the existing containers as rollback release: $bootstrap_dir"
}

rollback() {
  local previous_dir="$1"
  [[ -n "$previous_dir" && -d "$previous_dir" ]] \
    || fail 'The new release is unhealthy and no previous managed release is available.'

  echo "Rolling back to $previous_dir"
  compose "$previous_dir" up -d --remove-orphans || return 1
  wait_for_stack || return 1
  ln -sfn "$previous_dir" "$CURRENT_LINK"
  echo 'Rollback completed and verified.'
}

[[ "${DEPLOY_SHA:-}" =~ ^[0-9a-f]{40}$ ]] \
  || fail 'DEPLOY_SHA must be a complete lowercase 40-character commit SHA.'
[[ "${BACKEND_IMAGE:-}" =~ ^ghcr\.io/[a-z0-9._/-]+:sha-[0-9a-f]{40}$ ]] \
  || fail 'BACKEND_IMAGE must be an immutable GHCR sha tag.'
[[ "${AI_IMAGE:-}" =~ ^ghcr\.io/[a-z0-9._/-]+:sha-[0-9a-f]{40}$ ]] \
  || fail 'AI_IMAGE must be an immutable GHCR sha tag.'
[[ "$BACKEND_IMAGE" == *":sha-$DEPLOY_SHA" ]] \
  || fail 'BACKEND_IMAGE does not match DEPLOY_SHA.'
[[ "$AI_IMAGE" == *":sha-$DEPLOY_SHA" ]] \
  || fail 'AI_IMAGE does not match DEPLOY_SHA.'

readonly RELEASE_DIR="$RELEASES_DIR/$DEPLOY_SHA"
readonly COMPOSE_FILE="$RELEASE_DIR/compose.prod.yml"

require_file "$COMPOSE_FILE"
require_file "$BACKEND_ENV_FILE"
require_file "$AI_ENV_FILE"
command -v docker > /dev/null || fail 'Docker is not installed.'
command -v curl > /dev/null || fail 'curl is not installed.'
docker compose version > /dev/null || fail 'Docker Compose is not available.'

mkdir -p "$RELEASES_DIR"
write_release_env "$RELEASE_DIR" "$BACKEND_IMAGE" "$AI_IMAGE"
compose "$RELEASE_DIR" config --quiet
bootstrap_current_release

previous_dir=''
if [[ -L "$CURRENT_LINK" ]]; then
  previous_dir="$(readlink -f "$CURRENT_LINK")"
fi

echo "Pulling immutable images for commit $DEPLOY_SHA..."
if ! compose "$RELEASE_DIR" pull; then
  fail 'Unable to pull one or more production images.'
  exit 1
fi

echo 'Starting the new release...'
if compose "$RELEASE_DIR" up -d --remove-orphans && wait_for_stack; then
  if [[ -n "$previous_dir" && "$previous_dir" != "$RELEASE_DIR" ]]; then
    ln -sfn "$previous_dir" "$PREVIOUS_LINK"
  fi
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
  cleanup_after_successful_deploy
  echo "Deployment succeeded: $DEPLOY_SHA"
  exit 0
fi

echo 'The new release did not become healthy.' >&2
rollback "$previous_dir"
exit 1
