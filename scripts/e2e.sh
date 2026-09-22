#!/usr/bin/env bash
#
# Full end-to-end cycle against the dedicated TEST deployment.
#
#   1. build the SPA
#   2. deploy it as `tmi-portal-test`, bound to `tmi-portal-test-db`
#   3. wipe and rebuild that database from db/schema.sql + db/seed.sql
#   4. run the Playwright suite against it
#
# Production is never deployed to, never queried, and never wiped. The test
# Worker runs with authentication permanently off, which is what lets the suite
# act as each kind of user; it holds seeded fiction and nothing else.
#
set -euo pipefail

cd "$(dirname "$0")/.."

API_DIR="apps/api"
TEST_ENV="test"
TEST_DB="tmi-portal-test-db"
TEST_URL="${E2E_BASE_URL:-https://tmi-portal-test.om-ndessai.workers.dev}"

# Belt and braces. The destructive step below is driven by these names, so if
# either is ever edited towards production the script stops instead of running.
case "$TEST_DB" in
  *test*) ;;
  *) echo "Refusing to run: '$TEST_DB' is not a test database." >&2; exit 1 ;;
esac
case "$TEST_URL" in
  *test*|*localhost*|*127.0.0.1*) ;;
  *) echo "Refusing to run: '$TEST_URL' does not look like a test target." >&2; exit 1 ;;
esac

echo "==> Building the SPA"
npm run build >/dev/null

echo "==> Deploying the test Worker"
( cd "$API_DIR" && npx wrangler deploy --env "$TEST_ENV" >/dev/null )

echo "==> Rebuilding $TEST_DB (destructive, test data only)"
( cd "$API_DIR" \
  && npx wrangler d1 execute "$TEST_DB" --remote --file=./db/schema.sql >/dev/null \
  && npx wrangler d1 execute "$TEST_DB" --remote --file=./db/seed.sql >/dev/null )

# A deploy and a remote D1 rebuild are both eventually consistent, and the
# suite starts the instant they return. Twice now the first run after a deploy
# has failed and an immediate re-run has passed, which is what that looks like.
# The cause was never caught in the act, so this is a guard rather than a
# diagnosis: wait until the new Worker is answering AND the seeded roster is
# actually readable before asserting anything about either.
echo "==> Waiting for $TEST_URL to be ready"
for attempt in $(seq 1 30); do
  health=$(curl -s --max-time 10 "$TEST_URL/api/health" || true)
  people=$(curl -s --max-time 10 -H 'X-Dev-User: priya.raghavan@gmail.com' \
    "$TEST_URL/api/users?limit=1" || true)

  case "$health$people" in
    *'"status":"ok"'*'"meta"'*)
      echo "    ready after ${attempt}s"
      break
      ;;
  esac

  if [ "$attempt" -eq 30 ]; then
    echo "Refusing to run: $TEST_URL did not become ready." >&2
    echo "  health:  ${health:0:120}" >&2
    echo "  roster:  ${people:0:120}" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Running the end-to-end suite against $TEST_URL"
E2E_BASE_URL="$TEST_URL" npm run test --workspace @tmi/e2e
