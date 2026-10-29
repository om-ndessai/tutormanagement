# python3 doc_level.py <LEVEL> <results markdown file>  -- marks the level built, adds its topics table and results.
import json, sys
R = '/home/user/tutormanagement'; S = '/tmp/claude-0/-home-user-tutormanagement/56e7228e-11bf-50b4-a151-9171896c80d3/scratchpad/mk'
L, res = sys.argv[1], open(sys.argv[2]).read().strip()
lv = json.load(open(f'{S}/levels.json'))[L]
p = f'{R}/docs/question-bank-kangaroo.md'; s = open(p).read()
import re
s = re.sub(rf"(\| `{L}` \| [^|]+\| [^|]+\| )not yet \|", r"\1built |", s)
band = lv['grade_band']
table = f"### {band} (`{L}`)\n\nTopics proposed from the review in `docs/question-bank-kangaroo/profile-{L}.md`.\n\n| Topic | Name | Covers |\n| --- | --- | --- |\n" + \
  ''.join(f"| {t['id']} | {t['name']} | {t['description']} |\n" for t in lv['topics'])
if f"### {band} (`{L}`)" not in s:
    s = s.replace("## How a question is written and checked", table + "\n## How a question is written and checked", 1)
s = s.rstrip() + f"\n\n### {band} (2026-10-27)\n\n" + res + "\n"
open(p, 'w').write(s)
