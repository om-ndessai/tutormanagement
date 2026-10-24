#!/usr/bin/env bash
# The backward-compatibility test (Phase 49). LOCAL only: no Cloudflare quota, never production.
#
#   npm run test:compat [-- <base-ref>]        base: the newest release-* tag
#
# Production is never rebuilt: each release applies its SQL by hand (docs/database.md), and for a
# few minutes the OLD Worker runs on the NEW schema before `npm run deploy`. This rehearses that:
#   1. the last release's database: ITS schema, catalog, seed, platform admin and bank sample;
#   2. the production SQL pending since then (labelled blocks in docs/database.md), applied to it;
#   3. that database compared with a fresh build of today's schema.sql (compat-schema.mjs);
#   4. the last release's Worker on it, with ITS own @smoke tests (the window before the deploy);
#   5. today's Worker on it, with today's @smoke and @compat tests (rows written before the change).
# Steps 4-5 use ports 8798/8799 and 5195/5196, so a dev server on 8787/5173 is left alone.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
WORK="$ROOT/.compat"
BASE="${1:-$(git tag -l 'release-*' --sort=-creatordate | head -1)}"
[[ -z "$BASE" ]] && { echo "✗ no release-* tag; pass a base ref"; exit 2; }
git rev-parse --verify -q "$BASE^{commit}" >/dev/null || { echo "✗ $BASE is not a commit"; exit 2; }
echo "› backward compatibility against $BASE ($(git rev-parse --short "$BASE"))"

PIDS=()
cleanup() {
  for p in "${PIDS[@]:-}"; do [[ -n "$p" ]] && { pkill -P "$p" 2>/dev/null; kill "$p" 2>/dev/null; } || true; done
  # And anything still listening on this test's ports (a server's own children).
  for port in 8798 8799 5195 5196; do lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | xargs -r kill 2>/dev/null || true; done
}
trap cleanup EXIT

rm -rf "$WORK/migrated" "$WORK/fresh" "$WORK/files" && mkdir -p "$WORK/files" "$WORK/logs"
wr() { (cd apps/api && npx wrangler d1 execute tutoring-db --local --persist-to "$1" --file="$2" >/dev/null); }
show() { git show "$BASE:$1" > "$2" 2>/dev/null; }

# --- 1. The last release's database ------------------------------------------------------------
show apps/api/db/schema.sql "$WORK/files/schema.sql"
show apps/api/db/catalog.sql "$WORK/files/catalog.sql" || : > "$WORK/files/catalog.sql"
show apps/api/db/seed.sql "$WORK/files/seed.sql"
show apps/api/db/platform-admin.sql "$WORK/files/platform-admin.sql"
show apps/api/db/questions-sample.sql "$WORK/files/questions.sql" || cp apps/api/db/questions-sample.sql "$WORK/files/questions.sql"
for f in schema catalog seed platform-admin questions; do wr "$WORK/migrated" "$WORK/files/$f.sql"; done
echo "  built $BASE's database"

# --- 2. The pending production SQL -------------------------------------------------------------
node scripts/compat-pending.mjs "$BASE" > "$WORK/files/pending.sql"
[[ -s "$WORK/files/pending.sql" ]] && wr "$WORK/migrated" "$WORK/files/pending.sql"

# --- 3. The same schema both ways ----------------------------------------------------------------
wr "$WORK/fresh" "$ROOT/apps/api/db/schema.sql"
wr "$WORK/fresh" "$ROOT/apps/api/db/catalog.sql"
node scripts/compat-schema.mjs "$WORK/migrated" "$WORK/fresh"

up() { curl -sf -o /dev/null --max-time 5 "$1"; }
# A server already on one of these ports would answer in place of the one this test starts, and the
# test would quietly run against the wrong code and database. Refuse instead.
for port in 8798 8799 5195 5196; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ port $port is in use (lsof -nP -iTCP:$port); stop that server first"; exit 1
  fi
done
wait_for() { for _ in $(seq 1 90); do up "$1" && return 0; sleep 2; done; echo "✗ $1 did not come up"; return 1; }

# --- 4. The last release's Worker on the new schema --------------------------------------------
OLD="$ROOT/.compat/base-tree"
if [[ "$(git -C "$OLD" rev-parse HEAD 2>/dev/null || true)" != "$(git rev-parse "$BASE^{commit}")" ]]; then
  git worktree remove --force "$OLD" 2>/dev/null || rm -rf "$OLD"
  git worktree add -q --detach "$OLD" "$BASE"
  (cd "$OLD" && npm ci --no-audit --no-fund >"$WORK/logs/base-install.log" 2>&1)
fi
cp apps/api/.dev.vars "$OLD/apps/api/.dev.vars"
mkdir -p "$OLD/apps/web/dist"
(cd "$OLD/apps/api" && exec npx wrangler dev --port 8799 --persist-to "$WORK/migrated" >"$WORK/logs/base-worker.log" 2>&1) & PIDS+=($!)
(cd "$OLD/apps/web" && VITE_DEV_API_ORIGIN=http://127.0.0.1:8799 exec npx vite --port 5196 --strictPort >"$WORK/logs/base-vite.log" 2>&1) & PIDS+=($!)
wait_for http://localhost:8799/api/health && wait_for http://localhost:5196
echo "› $BASE's Worker on the migrated database: its own @smoke tests"
(cd "$OLD" && E2E_BASE_URL=http://localhost:5196 npm run test --workspace @tmi/e2e -- --grep @smoke --reporter=line)
cleanup; PIDS=()
sleep 2

# --- 5. Today's Worker on the old rows ------------------------------------------------------------
mkdir -p apps/web/dist
(cd apps/api && exec npx wrangler dev --port 8798 --persist-to "$WORK/migrated" >"$WORK/logs/worker.log" 2>&1) & PIDS+=($!)
(cd apps/web && VITE_DEV_API_ORIGIN=http://127.0.0.1:8798 exec npx vite --port 5195 --strictPort >"$WORK/logs/vite.log" 2>&1) & PIDS+=($!)
wait_for http://localhost:8798/api/health && wait_for http://localhost:5195
echo "› today's Worker on the migrated database: @smoke and @compat"
E2E_BASE_URL=http://localhost:5195 npm run test --workspace @tmi/e2e -- --grep "@smoke|@compat" --reporter=line

echo "compat: passed against $BASE"
