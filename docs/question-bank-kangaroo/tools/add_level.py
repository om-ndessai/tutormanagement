# python3 add_level.py <LEVEL>  -- wires one Math Kangaroo level into the catalog and the shared lists.
import json, re, sys
R = '/home/user/tutormanagement'
S = '/tmp/claude-0/-home-user-tutormanagement/56e7228e-11bf-50b4-a151-9171896c80d3/scratchpad/mk'
lv = sys.argv[1]
level = json.load(open(f'{S}/levels.json'))[lv]
label = 'Kangaroo ' + level['grade_band'].replace('Grades ', '')

cat = json.load(open(f'{R}/apps/api/db/catalog/mk.json'))
if lv not in [l['id'] for l in cat['levels']]:
    cat['levels'].append(level)
    cat['levels'].sort(key=lambda l: l['stage'])
    open(f'{R}/apps/api/db/catalog/mk.json', 'w').write(json.dumps(cat, indent=2, ensure_ascii=False) + '\n')

def edit(path, pattern, repl):
    s = open(path).read()
    n = re.subn(pattern, repl, s, count=1)
    if n[1] != 1: sys.exit(f'{path}: pattern not found: {pattern}')
    open(path, 'w').write(n[0])

ids = [l['id'] for l in cat['levels']]
q = lambda xs: ', '.join(f"'{x}'" for x in xs)
s = open(f'{R}/packages/shared/src/questions.ts').read()
if f"'{lv}'," not in s:
    prev = ids[ids.index(lv) - 1]
    edit(f'{R}/packages/shared/src/questions.ts', f"  '{prev}',\n", f"  '{prev}',\n  '{lv}',\n")
s = open(f'{R}/packages/shared/src/canvas-assessments.ts').read()
if f"  {lv}: " not in s:
    prev = ids[ids.index(lv) - 1]
    edit(f'{R}/packages/shared/src/canvas-assessments.ts', rf"(  {prev}: '[^']*',\n)", rf"\1  {lv}: '{label}',\n")
edit(f'{R}/packages/shared/src/quest.ts', r"  \['MK12'[^\]]*\],", f"  [{q(ids)}],")
edit(f'{R}/apps/api/db/generate-questions.mjs', r"  \.\.\.\['MK12'[^\]]*\],", f"  ...[{q(ids)}],")
edit(f'{R}/e2e/tests/question-bank.spec.ts', r"      \.\.\.\['MK12'[^\]]*\],", f"      ...[{q(ids)}],")
print(lv, 'wired; levels now', ids)
