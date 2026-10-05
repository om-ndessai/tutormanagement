#!/usr/bin/env bash
#
# Full end-to-end cycle against the TUTORING test deployment (orgsupport).
#
#   1. build the SPA
#   2. deploy it as `tutoring-test`, bound to `tutoring-test-db`
#   3. wipe and rebuild that database from db/schema.sql + db/seed.sql, and
#      add the platform admin (db/platform-admin.sql)
#   4. run the Playwright suite against it
#
# Never the institute's tmi-portal or its demo, and never `tutoring` itself.
# The test Worker runs with authentication permanently off, which is what lets
# the suite act as each kind of user; it holds seeded fiction and nothing else.
#
set -euo pipefail

cd "$(dirname "$0")/.."

API_DIR="apps/api"
TEST_ENV="tutoring-test"
TEST_DB="tutoring-test-db"
TEST_URL="${E2E_BASE_URL:-https://tutoring-test.om-ndessai.workers.dev}"

# Belt and braces. The destructive step below is driven by these names, so if
# either is ever edited towards production the script stops instead of running.
case "$TEST_DB" in
  tutoring-test-db) ;;
  *) echo "Refusing to run: '$TEST_DB' is not a test database." >&2; exit 1 ;;
esac
case "$TEST_URL" in
  *tutoring-test*|*localhost*|*127.0.0.1*) ;;
  *) echo "Refusing to run: '$TEST_URL' does not look like a test target." >&2; exit 1 ;;
esac

# If somebody turned sign-in on for this deployment, it signs people in for
# real. The suite acts as each kind of user through X-Dev-User, which is
# honoured only while AUTH_ENABLED is "false", so it cannot drive that -- and
# the rebuild below would wipe real sign-ins on the way to finding out.
# Checked before anything is built, deployed or dropped.
echo "==> Checking $TEST_URL can be driven by the suite"
auth=$(curl -s --max-time 15 "$TEST_URL/api/auth/config" || true)
case "$auth" in
  *'"auth_enabled":true'*)
    cat >&2 <<MESSAGE
Refusing to run: $TEST_URL has authentication ENABLED.

The suite names the user it wants per request with X-Dev-User, which the Worker
honours only while AUTH_ENABLED is "false". Nothing was deployed and no data
was touched.

  - To run the suite, drive a local stack instead:
      npm run dev
      E2E_BASE_URL=http://localhost:5173 npm run e2e:test
  - To hand this deployment back to the suite, set AUTH_ENABLED to "false" in
    the "test" env of apps/api/wrangler.jsonc and deploy it.
MESSAGE
    exit 1
    ;;
esac

echo "==> Building the SPA"
npm run build >/dev/null

echo "==> Deploying the test Worker"
( cd "$API_DIR" && npx wrangler deploy --env "$TEST_ENV" >/dev/null )

echo "==> Rebuilding $TEST_DB (destructive, test data only)"
( cd "$API_DIR" \
  && npx wrangler d1 execute "$TEST_DB" --remote --file=./db/schema.sql >/dev/null \
  && npx wrangler d1 execute "$TEST_DB" --remote --file=./db/seed.sql >/dev/null \
  && npx wrangler d1 execute "$TEST_DB" --remote --file=./db/platform-admin.sql >/dev/null )

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
    -H 'X-Organization: chmi' "$TEST_URL/api/users?limit=1" || true)

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
