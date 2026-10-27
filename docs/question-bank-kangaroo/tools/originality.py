# python3 originality.py <draft.json>...  -- any 10-word run a question shares with a paper (mk-src/txt).
import glob, json, re, sys
N = 10
W = lambda t: re.findall(r"[a-z0-9]+", t.lower())
grams = set()
for f in glob.glob('/tmp/claude-0/-home-user-tutormanagement/56e7228e-11bf-50b4-a151-9171896c80d3/scratchpad/mk-src/txt/*.txt'):
    w = W(open(f, errors='ignore').read()); grams |= {' '.join(w[i:i+N]) for i in range(len(w) - N + 1)}
total = 0
for f in sys.argv[1:]:
    for q in json.load(open(f))['questions']:
        w = W(q['stem']); hits = [' '.join(w[i:i+N]) for i in range(len(w) - N + 1) if ' '.join(w[i:i+N]) in grams]
        if hits: total += 1; print(q['id'], hits[:2])
print('questions sharing a 10-word run with a paper:', total)
