import json,sys
d=json.load(open(sys.argv[1]))['questions']
ch=[q for q in d if q['kind']=='choice']
lo=sum(1 for q in ch if all(len(c)<len(q['answer']) for c in q['choices'] if c!=q['answer']))
sh=sum(1 for q in ch if all(len(c)>len(q['answer']) for c in q['choices'] if c!=q['answer']))
print(len(d),len(ch),lo,sh)
