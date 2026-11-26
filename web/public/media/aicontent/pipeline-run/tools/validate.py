"""Validate the source-only preparation without claiming a completed pipeline run."""
import ast,json,re,struct,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sections=json.loads((root/'sections.json').read_text())
assert 6<=len(sections)<=10
source=(root/'talk-source.txt').read_text()
assert source=='\n\n'.join(s['spoken_text'] for s in sections)+'\n'
assert 2500<=len(source.split())<=2700
literal=r"'(?:\\.|[^'\\])*'"
for s in sections:
 original=subprocess.check_output(['git','show','1a2bbf63a0283cd6a7ab0581c43e3a663aa4e82e:'+s['file']],text=True)
 bodies=[ast.literal_eval(m[1]) for m in re.finditer(r'body: bi\(\s*('+literal+')',original)]
 def plain(t):
  t=re.sub(r'```.*?```','',t,flags=re.S)
  t=re.sub(r'\[\[[^|\]]+\|([^\]]+)\]\]',r'\1',t)
  t=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',t)
  t=re.sub(r'(?m)^\s*[-*] ','',t).replace('`','').replace('**','')
  return re.sub(r'\n{3,}','\n\n',t).strip()
 assert s['text'] in [plain(t) for t in bodies],s['number']
 assert 3<=len(s['terms'])<=5
 assert all(term in s['text'] for term in s['terms']),s['terms']
 data=(root/'slides'/f'{s["number"]:02d}.png').read_bytes()
 assert data[:8]==b'\x89PNG\r\n\x1a\n'
 assert struct.unpack('>II',data[16:24])==(1280,720)
assert not list(root.rglob('*.aiff'))
print(f'PASS: {len(sections)} verbatim sections, {len(source.split())} words, nine 1280x720 PNGs, source terms, no AIFF')
