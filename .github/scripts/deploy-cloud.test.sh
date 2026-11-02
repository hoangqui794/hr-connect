#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly DEPLOY_SCRIPT="$REPO_ROOT/deploy/scripts/deploy-production.sh"
readonly COMPOSE_FILE="$REPO_ROOT/deploy/compose.prod.yml"
readonly TEST_SHA='8ef754a92ab30422544f1fbcaf9af5b964c89688'

fail() {
  echo "TEST FAILED: $1" >&2
  exit 1
}

make_fixture() {
  local fixture_dir="$1"
  mkdir -p "$fixture_dir/bin" "$fixture_dir/deploy/env" "$fixture_dir/deploy/releases/$TEST_SHA"
  cp "$COMPOSE_FILE" "$fixture_dir/deploy/releases/$TEST_SHA/compose.prod.yml"
  : > "$fixture_dir/deploy/env/backend.env"
  : > "$fixture_dir/deploy/env/ai-v2.env"

  cat > "$fixture_dir/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$MOCK_DOCKER_LOG"

if [[ "$1" == 'inspect' && "$*" == *'hrconnect-backend'* ]]; then
  printf 'hrconnect-backend:local\n'
elif [[ "$1" == 'inspect' && "$*" == *'hrconnect-ai-v2'* ]]; then
  printf 'hrconnect-ai-v2:local\n'
else
  exit 0
fi
MOCK_DOCKER

  cat > "$fixture_dir/bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -Eeuo pipefail
calls="$(cat "$MOCK_CURL_STATE" 2>/dev/null || printf '0')"
calls="$((calls + 1))"
printf '%s' "$calls" > "$MOCK_CURL_STATE"

if [[ "${MOCK_FAIL_NEW_RELEASE:-false}" == 'true' && "$calls" -le 2 ]]; then
  exit 22
fi
exit 0
MOCK_CURL

  cat > "$fixture_dir/bin/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
exit 0
MOCK_SLEEP

  chmod +x "$fixture_dir/bin/docker" "$fixture_dir/bin/curl" "$fixture_dir/bin/sleep"
}

run_deploy() {
  local fixture_dir="$1"
  local fail_new_release="${2:-false}"

  PATH="$fixture_dir/bin:$PATH" \
    DEPLOY_ROOT="$fixture_dir/deploy" \
    DEPLOY_SHA="$TEST_SHA" \
    BACKEND_IMAGE="ghcr.io/hrconnect/backend:sha-$TEST_SHA" \
    AI_IMAGE="ghcr.io/hrconnect/ai-v2:sha-$TEST_SHA" \
    HEALTH_ATTEMPTS=2 \
    HEALTH_DELAY_SECONDS=0 \
    MOCK_DOCKER_LOG="$fixture_dir/docker.log" \
    MOCK_CURL_STATE="$fixture_dir/curl-state" \
    MOCK_FAIL_NEW_RELEASE="$fail_new_release" \
    bash "$DEPLOY_SCRIPT"
}

bash -n "$DEPLOY_SCRIPT"

success_fixture="$(mktemp -d)"
rollback_fixture="$(mktemp -d)"
invalid_fixture="$(mktemp -d)"
trap 'rm -rf "$success_fixture" "$rollback_fixture" "$invalid_fixture"' EXIT

make_fixture "$success_fixture"
run_deploy "$success_fixture"
grep -q 'compose.*pull' "$success_fixture/docker.log" \
  || fail 'Healthy deployment did not pull images.'
grep -q 'container prune --force --filter until=24h' "$success_fixture/docker.log" \
  || fail 'Healthy deployment did not prune stopped containers.'
grep -q 'image prune --all --force --filter until=168h' "$success_fixture/docker.log" \
  || fail 'Healthy deployment did not prune unused images.'
grep -q 'builder prune --force --filter until=24h' "$success_fixture/docker.log" \
  || fail 'Healthy deployment did not prune build cache.'
if grep -q 'volume prune' "$success_fixture/docker.log"; then
  fail 'Deployment cleanup must never prune Docker volumes.'
fi

if [[ "${OSTYPE:-}" != msys* && "${OSTYPE:-}" != cygwin* ]]; then
  [[ "$(basename "$(readlink -f "$success_fixture/deploy/current")")" == "$TEST_SHA" ]] \
    || fail 'Healthy deployment did not become current.'

  make_fixture "$rollback_fixture"
  mkdir -p "$rollback_fixture/deploy/releases/previous"
  cp "$COMPOSE_FILE" "$rollback_fixture/deploy/releases/previous/compose.prod.yml"
  cat > "$rollback_fixture/deploy/releases/previous/release.env" <<'EOF'
BACKEND_IMAGE=hrconnect-backend:local
AI_IMAGE=hrconnect-ai-v2:local
EOF
  ln -s "$rollback_fixture/deploy/releases/previous" "$rollback_fixture/deploy/current"
  if run_deploy "$rollback_fixture" true; then
    fail 'An unhealthy deployment must return a failure status after rollback.'
  fi
  if grep -q 'builder prune\|image prune\|container prune' "$rollback_fixture/docker.log"; then
    fail 'Cleanup must not run after an unhealthy deployment or rollback.'
  fi
  [[ "$(basename "$(readlink -f "$rollback_fixture/deploy/current")")" == 'previous' ]] \
    || fail 'Unhealthy deployment did not restore the previous release.'
else
  echo 'SKIP: symlink rollback assertion requires a Linux filesystem (covered by CI).'
fi

make_fixture "$invalid_fixture"
if PATH="$invalid_fixture/bin:$PATH" \
  DEPLOY_ROOT="$invalid_fixture/deploy" \
  DEPLOY_SHA='not-a-sha' \
  BACKEND_IMAGE='ghcr.io/hrconnect/backend:latest' \
  AI_IMAGE='ghcr.io/hrconnect/ai-v2:latest' \
  bash "$DEPLOY_SCRIPT" > /dev/null 2>&1; then
  fail 'Invalid mutable deployment identifiers were accepted.'
fi

echo 'PASS: cloud deployment script validation, success and rollback scenarios'
