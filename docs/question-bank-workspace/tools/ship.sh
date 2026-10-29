#!/usr/bin/env bash
# ship.sh <chunk>... : merge solved chunks, verify, regenerate SQL, commit and push.
set -e
cd "$(dirname "$0")/.."
node tools/merge.mjs "$@"
node tools/verify.mjs | tail -1 | grep -q ", 0 failing" || { echo "VERIFY FAILED"; node tools/verify.mjs | tail -5; exit 1; }
node tools/finalize.mjs
N=$(node tools/status.mjs | head -1)
cd "${QB_REPO:-/home/user/tutormanagement}"
git add apps/api/db
git diff --cached --quiet && { echo "nothing new"; exit 0; }
git commit -q -m "Question bank: NC 2017 pass B, chunks $* ($N)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01N9d6hnTbhBSBh46jPutAJ5"
for i in 1 2 3 4; do git push -q origin claude/sweet-darwin-s30s5m 2>&1 | grep -v '^remote:' && break || sleep $((2**i)); done
git log --oneline -1
