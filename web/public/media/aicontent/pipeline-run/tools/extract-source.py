import re,ast,json,subprocess
from pathlib import Path
lit=r"'(?:\\.|[^'\\])*'"
out=[]
for path in sorted(Path('web/src/blocks/networks').glob('lessons-?.ts')):
 t=subprocess.check_output(['git','show','1a2bbf63a0283cd6a7ab0581c43e3a663aa4e82e:'+str(path)],text=True)
 for m in re.finditer(r"\{\s*id: ('[^']+'),\s*kind: 'text',(?:(?!\bbody:).)*?body: bi\(\s*("+lit+r")",t,re.S):
  block=m.group(); title=re.search(r'title: bi\(('+lit+')',block)
  if not title: continue
  body=ast.literal_eval(m[2]); body=re.sub(r'```.*?```','',body,flags=re.S)
  body=re.sub(r'\[\[[^|\]]+\|([^\]]+)\]\]',r'\1',body)
  body=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',body)
  body=re.sub(r'(?m)^\s*[-*] ', '',body); body=body.replace('`','').replace('**','')
  body=re.sub(r'\n{3,}','\n\n',body).strip()
  out.append(dict(file=str(path),line=t[:m.start()].count('\n')+1,id=ast.literal_eval(m[1]),title=ast.literal_eval(title[1]),text=body,words=len(body.split())))
Path('/tmp/devops-wave3-pipeline-candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for i,s in enumerate(out):print(i,s['words'],s['title'])
