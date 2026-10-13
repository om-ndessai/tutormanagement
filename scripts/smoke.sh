#!/usr/bin/env bash
# The smoke test: the fast path through BOTH clients of the Worker -- the web app (Playwright,
# the tests tagged @smoke) and the mobile app (Maestro, the flows tagged smoke, on the iOS
# simulator and the Android emulator) -- against the LOCAL Worker and the local seeded D1.
# Never production, never the demo, and no Cloudflare quota.
#
#   npm run smoke -- [all|web|mobile|ios|android]
#
# Run it after any change to the Worker's API (apps/api/src), the shared contract
# (packages/shared) or the schema and seed (apps/api/db): the two clients are built apart, so a
# change made for one is not checked against the other by typecheck alone.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
# Not under e2e/test-results: Playwright empties that at the start of every run.
LOGS="$ROOT/.smoke"
mkdir -p "$LOGS"

TARGET="${1:-all}"
case "$TARGET" in
  all|web|mobile|ios|android) ;;
  *) echo "usage: npm run smoke -- [all|web|mobile|ios|android]" >&2; exit 2 ;;
esac

API=http://localhost:8787
WEB=http://localhost:5173

# --- 1. Local only, sign-in off -------------------------------------------------------------
up() { curl -sf -o /dev/null --max-time 5 "$1"; }
wait_for() { for _ in $(seq 1 60); do up "$1" && return 0; sleep 2; done; return 1; }

if ! up "$API/api/health"; then
  echo "› starting the local Worker (npm run dev:api)"
  (npm run dev:api >"$LOGS/worker.log" 2>&1 &)
  wait_for "$API/api/health" || { echo "✗ the local Worker did not start (see $LOGS/worker.log)"; exit 1; }
fi
if curl -s "$API/api/auth/config" | grep -q '"auth_enabled":true'; then
  echo "✗ the local Worker has sign-in switched on; both suites sign in through X-Dev-User. Refusing."; exit 1
fi

# --- 2. The web app -------------------------------------------------------------------------
run_web() {
  if ! up "$WEB"; then
    echo "› starting Vite (npm run dev:web)"
    (npm run dev:web >"$LOGS/vite.log" 2>&1 &)
    wait_for "$WEB" || { echo "✗ Vite did not start (see $LOGS/vite.log)"; return 1; }
  fi
  echo "› resetting the local database"
  npm run db:reset >"$LOGS/db-reset.log" 2>&1
  echo "› running the web tests tagged @smoke"
  E2E_BASE_URL=$WEB npm run test --workspace @tmi/e2e -- --grep @smoke
}

# --- 3. The mobile app (resets the database itself, before and after) -------------------------
run_mobile() { bash scripts/e2e-mobile.sh "$1" --tags=smoke; }

web=skipped; mobile=skipped
if [[ $TARGET == all || $TARGET == web ]]; then
  if run_web; then web=passed; else web=FAILED; fi
fi
case "$TARGET" in
  all|mobile) if run_mobile both; then mobile=passed; else mobile=FAILED; fi ;;
  ios|android) if run_mobile "$TARGET"; then mobile=passed; else mobile=FAILED; fi ;;
esac

echo "smoke: web $web, mobile $mobile"
[[ $web != FAILED && $mobile != FAILED ]]
