#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly DEPLOY_SCRIPT="$REPO_ROOT/deploy/scripts/deploy-production.sh"
readonly COMPOSE_FILE="$REPO_ROOT/deploy/compose.prod.yml"
readonly CADDY_FILE="$REPO_ROOT/deploy/caddy/Caddyfile"
readonly FIRST_SHA='8ef754a92ab30422544f1fbcaf9af5b964c89688'
readonly SECOND_SHA='9ef754a92ab30422544f1fbcaf9af5b964c89689'

fail() {
  echo "TEST FAILED: $1" >&2
  exit 1
}

add_release() {
  local fixture_dir="$1"
  local sha="$2"
  local release_dir="$fixture_dir/deploy/releases/$sha"
  mkdir -p "$release_dir"
  cp "$COMPOSE_FILE" "$release_dir/compose.prod.yml"
  cp "$CADDY_FILE" "$release_dir/Caddyfile"
}

make_fixture() {
  local fixture_dir="$1"
  mkdir -p "$fixture_dir/bin" "$fixture_dir/deploy/env"
  add_release "$fixture_dir" "$FIRST_SHA"
  : > "$fixture_dir/deploy/env/backend.env"
  : > "$fixture_dir/deploy/env/ai-v2.env"

  cat > "$fixture_dir/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$MOCK_DOCKER_LOG"
exit 0
MOCK_DOCKER

  cat > "$fixture_dir/bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -Eeuo pipefail
url="${*: -1}"
printf '%s\n' "$url" >> "$MOCK_CURL_LOG"
case "${MOCK_CURL_MODE:-success}" in
  direct-failure) [[ "$url" == http://127.0.0.1:* ]] && exit 22 ;;
  public-failure) [[ "$url" == https://* ]] && exit 22 ;;
esac
if [[ "$url" == */health/worker ]]; then
  color='blue'
  [[ "$url" == *':28001/'* ]] && color='green'
  selected="$(cat "$MOCK_AI_ACTIVE_COLOR_FILE" 2>/dev/null || true)"
  if [[ "$selected" == "$color" ]]; then
    printf '{"workersActive":true}\n'
  else
    printf '{"workersActive":false}\n'
  fi
fi
exit 0
MOCK_CURL

  cat > "$fixture_dir/bin/caddy" <<'MOCK_CADDY'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$MOCK_CADDY_LOG"
exit 0
MOCK_CADDY

  cat > "$fixture_dir/bin/sudo" <<'MOCK_SUDO'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$MOCK_SUDO_LOG"
exit 0
MOCK_SUDO

  cat > "$fixture_dir/bin/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
exit 0
MOCK_SLEEP

  cat > "$fixture_dir/bin/flock" <<'MOCK_FLOCK'
#!/usr/bin/env bash
exit 0
MOCK_FLOCK

  chmod +x "$fixture_dir/bin/"*
}

run_deploy() {
  local fixture_dir="$1"
  local sha="$2"
  local curl_mode="${3:-success}"
  PATH="$fixture_dir/bin:$PATH" \
    DEPLOY_ROOT="$fixture_dir/deploy" \
    CADDY_SYSTEM_CONFIG="$fixture_dir/deploy/caddy/Caddyfile" \
    DEPLOY_SHA="$sha" \
    BACKEND_IMAGE="ghcr.io/hrconnect/backend:sha-$sha" \
    AI_IMAGE="ghcr.io/hrconnect/ai-v2:sha-$sha" \
    HEALTH_ATTEMPTS=1 \
    HEALTH_DELAY_SECONDS=0 \
    DRAIN_SECONDS=0 \
    MOCK_DOCKER_LOG="$fixture_dir/docker.log" \
    MOCK_CURL_LOG="$fixture_dir/curl.log" \
    MOCK_CADDY_LOG="$fixture_dir/caddy.log" \
    MOCK_SUDO_LOG="$fixture_dir/sudo.log" \
    MOCK_AI_ACTIVE_COLOR_FILE="$fixture_dir/deploy/data/ai-v2/active-color" \
    MOCK_CURL_MODE="$curl_mode" \
    bash "$DEPLOY_SCRIPT"
}

assert_no_destructive_cleanup() {
  if grep -Eq 'volume prune|system prune' "$1"; then
    fail 'Deployment cleanup must never prune volumes or the whole Docker system.'
  fi
}

bash -n "$DEPLOY_SCRIPT"
success_fixture="$(mktemp -d)"
pre_switch_fixture="$(mktemp -d)"
rollback_fixture="$(mktemp -d)"
invalid_fixture="$(mktemp -d)"
trap 'rm -rf "$success_fixture" "$pre_switch_fixture" "$rollback_fixture" "$invalid_fixture"' EXIT

make_fixture "$success_fixture"
run_deploy "$success_fixture" "$FIRST_SHA"
grep -q '^blue$' "$success_fixture/deploy/state/active-color" || fail 'First deployment did not activate blue.'
grep -q '^blue$' "$success_fixture/deploy/data/ai-v2/active-color" || fail 'First deployment did not activate the blue AI worker.'
grep -q '127.0.0.1:18080' "$success_fixture/deploy/caddy/active-upstreams.caddy" || fail 'Backend did not switch to blue.'
grep -q '127.0.0.1:18001' "$success_fixture/deploy/caddy/active-upstreams.caddy" || fail 'AI did not switch to blue.'
grep -q -- '--project-name hrconnect-blue.*run --rm --no-deps backend --migrate' "$success_fixture/docker.log" || fail 'Migration did not run before startup.'
grep -q -- '--project-name hrconnect-blue.*up -d --remove-orphans' "$success_fixture/docker.log" || fail 'Blue services were not started.'
grep -q '^stop hrconnect-backend hrconnect-ai-v2$' "$success_fixture/docker.log" || fail 'Legacy containers were not stopped.'
grep -q 'container prune --force --filter until=24h' "$success_fixture/docker.log" || fail 'Stopped containers were not pruned.'
grep -q 'image prune --all --force --filter until=168h' "$success_fixture/docker.log" || fail 'Unused images were not pruned.'
grep -q 'builder prune --force --filter until=24h' "$success_fixture/docker.log" || fail 'Build cache was not pruned.'
assert_no_destructive_cleanup "$success_fixture/docker.log"

add_release "$success_fixture" "$SECOND_SHA"
run_deploy "$success_fixture" "$SECOND_SHA"
grep -q '^green$' "$success_fixture/deploy/state/active-color" || fail 'Second deployment did not activate green.'
grep -q '^green$' "$success_fixture/deploy/data/ai-v2/active-color" || fail 'Second deployment did not hand the AI queue to green.'
grep -q '127.0.0.1:28080' "$success_fixture/deploy/caddy/active-upstreams.caddy" || fail 'Backend did not switch to green.'
if [[ "${OSTYPE:-}" != msys* && "${OSTYPE:-}" != cygwin* ]]; then
  grep -q -- '--project-name hrconnect-blue.*down --remove-orphans' "$success_fixture/docker.log" || fail 'Previous blue services were not stopped.'
else
  echo 'SKIP: previous-release symlink assertion requires a Linux filesystem (covered by CI).'
fi

make_fixture "$pre_switch_fixture"
if run_deploy "$pre_switch_fixture" "$FIRST_SHA" direct-failure; then
  fail 'An unhealthy inactive color must fail before traffic switches.'
fi
[[ ! -f "$pre_switch_fixture/deploy/state/active-color" ]] || fail 'Pre-switch failure changed the active color.'
[[ ! -f "$pre_switch_fixture/deploy/caddy/active-upstreams.caddy" ]] || fail 'Pre-switch failure changed Caddy.'
if grep -q 'container prune\|image prune\|builder prune' "$pre_switch_fixture/docker.log"; then
  fail 'Cleanup ran after a pre-switch failure.'
fi

make_fixture "$rollback_fixture"
mkdir -p "$rollback_fixture/deploy/state" "$rollback_fixture/deploy/caddy" "$rollback_fixture/deploy/releases/previous"
cp "$COMPOSE_FILE" "$rollback_fixture/deploy/releases/previous/compose.prod.yml"
cat > "$rollback_fixture/deploy/releases/previous/release.env" <<'EOF'
DEPLOY_COLOR=blue
BACKEND_HOST_PORT=18080
AI_HOST_PORT=18001
BACKEND_IMAGE=ghcr.io/hrconnect/backend:sha-old
AI_IMAGE=ghcr.io/hrconnect/ai-v2:sha-old
BACKEND_ENV_FILE=/tmp/backend.env
AI_ENV_FILE=/tmp/ai.env
AI_DATA_DIR=/tmp/ai-data
EOF
printf 'blue\n' > "$rollback_fixture/deploy/state/active-color"
mkdir -p "$rollback_fixture/deploy/data/ai-v2"
printf 'blue\n' > "$rollback_fixture/deploy/data/ai-v2/active-color"
cat > "$rollback_fixture/deploy/caddy/active-upstreams.caddy" <<'EOF'
(backend_upstream) {
	reverse_proxy 127.0.0.1:18080
}
(ai_v2_upstream) {
	reverse_proxy 127.0.0.1:18001
}
EOF
cp "$CADDY_FILE" "$rollback_fixture/deploy/caddy/Caddyfile"
if [[ "${OSTYPE:-}" != msys* && "${OSTYPE:-}" != cygwin* ]]; then
  ln -s "$rollback_fixture/deploy/releases/previous" "$rollback_fixture/deploy/current"
fi
if run_deploy "$rollback_fixture" "$FIRST_SHA" public-failure; then
  fail 'Failed public smoke checks must return failure after rollback.'
fi
grep -q '^blue$' "$rollback_fixture/deploy/state/active-color" || fail 'Rollback changed active color state.'
grep -q '127.0.0.1:18080' "$rollback_fixture/deploy/caddy/active-upstreams.caddy" || fail 'Rollback did not restore blue.'
grep -q -- '--project-name hrconnect-green.*down --remove-orphans' "$rollback_fixture/docker.log" || fail 'Failed green services were not stopped.'
if grep -q 'container prune\|image prune\|builder prune' "$rollback_fixture/docker.log"; then
  fail 'Cleanup ran after rollback.'
fi

make_fixture "$invalid_fixture"
if PATH="$invalid_fixture/bin:$PATH" DEPLOY_ROOT="$invalid_fixture/deploy" DEPLOY_SHA='not-a-sha' \
  BACKEND_IMAGE='ghcr.io/hrconnect/backend:latest' AI_IMAGE='ghcr.io/hrconnect/ai-v2:latest' \
  bash "$DEPLOY_SCRIPT" > /dev/null 2>&1; then
  fail 'Invalid mutable deployment identifiers were accepted.'
fi

echo 'PASS: blue-green deployment switch, rollback, migration and cleanup scenarios'
