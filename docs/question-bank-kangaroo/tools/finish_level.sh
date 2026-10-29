#!/bin/bash
# finish_level.sh <LEVEL> "<contest level and grades>"  -- wire, merge, regenerate. Commit separately.
set -euo pipefail
L=$1; DESC=$2
S=/tmp/claude-0/-home-user-tutormanagement/56e7228e-11bf-50b4-a151-9171896c80d3/scratchpad
R=/home/user/tutormanagement
python3 $S/tools/add_level.py $L
python3 - "$L" <<'PY'
import json, sys
L = sys.argv[1]
S = '/tmp/claude-0/-home-user-tutormanagement/56e7228e-11bf-50b4-a151-9171896c80d3/scratchpad/mk'
lv = json.load(open(f'{S}/levels.json'))[L]
notes = {t['id']: 'Text only: every figure, grid or solid is described in words, with each assumption stated. Original questions on the topic\'s skills; options numeric in increasing order where they are numbers.' for t in lv['topics']}
json.dump(notes, open(f'{S}/notes-{L}.json', 'w'), indent=1)
PY
cd $S/mk
node $S/tools/merge.mjs $L drafts solve-out $R/apps/api/db/questions/$L.json $R/docs/question-bank-kangaroo/ids-$L.json "Round 6 (2026-10-27): original questions in the style of the Math Kangaroo contest's $DESC level, written by Claude Sonnet after a review of the 2016-2025 papers (docs/question-bank-kangaroo.md) and solved blind by Claude Opus (Claude Code agents, not runAi: no ai_runs rows), code-checked by lintQuestion; \"checked\" questions await a platform admin. No question or text of the papers is reproduced." notes-$L.json
cp $S/mk/profile-$L.md $R/docs/question-bank-kangaroo/profile-$L.md
cd $R/apps/api && node db/generate-catalog.mjs && node db/generate-questions.mjs
