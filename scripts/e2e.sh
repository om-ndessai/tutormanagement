#!/usr/bin/env bash
#
# Full end-to-end cycle against the DEPLOYED portal, per docs/plan.md:
#
#   1. deploy with authentication switched OFF
#   2. wipe and rebuild the remote database from db/schema.sql + db/seed.sql
#   3. run the Playwright suite
#   4. switch authentication back ON, whatever happened
#
# THIS DESTROYS ALL DATA IN THE REMOTE DATABASE and leaves the live URL open
# to anyone for the duration of the run. That is what the plan asks for; it is
# only safe while the portal holds nothing real.
#
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="tmi-portal-db"
API_DIR="apps/api"

if [[ "${E2E_YES:-}" != "1" ]]; then
  cat <<'WARN'
This will:
  * DESTROY every row in the remote tmi-portal-db
  * deploy the live portal with authentication DISABLED for the duration

Re-run with E2E_YES=1 to proceed:

    E2E_YES=1 npm run e2e
WARN
  exit 1
fi

# Auth goes back on even if the tests fail or the run is interrupted, so a
# failed run can never leave the portal open.
restore_auth() {
  echo "==> Restoring authentication"
  ( cd "$API_DIR" && npx wrangler deploy --var AUTH_ENABLED:true >/dev/null ) \
    && echo "    authentication is back ON" \
    || echo "    !! FAILED to restore auth - run 'npm run deploy' NOW"
}
trap restore_auth EXIT

echo "==> Building the SPA"
npm run build >/dev/null

echo "==> Deploying with authentication disabled"
( cd "$API_DIR" && npx wrangler deploy --var AUTH_ENABLED:false >/dev/null )

echo "==> Rebuilding the remote database (destructive)"
( cd "$API_DIR" \
  && npx wrangler d1 execute "$DB_NAME" --remote --file=./db/schema.sql >/dev/null \
  && npx wrangler d1 execute "$DB_NAME" --remote --file=./db/seed.sql >/dev/null )

echo "==> Running the end-to-end suite"
npm run test --workspace @tmi/e2e
