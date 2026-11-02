#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export LD_LIBRARY_PATH="$HOME/.local/lib/playwright-deps/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"

cd "$DIR/HRConnect-FE"
node e2e/automation/runner.mjs "$@"
