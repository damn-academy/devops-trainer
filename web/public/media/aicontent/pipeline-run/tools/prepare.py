import json,subprocess,shutil,html
from pathlib import Path
root=Path(__file__).resolve().parents[1]
candidates=json.loads(Path('/tmp/devops-wave3-pipeline-candidates.json').read_text())
indices=[1,12,14,26,20,34,37,41,49]
terms=[['интернет','BGP','IXP'],['ARP','MAC','IP'],['маршрутизатор','IP','маршрут'],['DNS','резолвер','авторитативный'],['TCP','SYN','RST'],['NAT','conntrack','порт'],['HTTP','GET','POST'],['TLS','сертификат','SNI'],['браузер','CDN','nginx']]
sections=[candidates[i] for i in indices]
for i,s in enumerate(sections):
 s['number']=i+1;s['terms']=terms[i]
 # Use exact surface forms present in the text, including inflection/case.
 import re
 s['terms']=[next((m.group() for m in re.finditer(r'\S+',s['text']) if term.lower() in m.group().lower()),term).strip('.,:;()«»') for term in terms[i]]
 s['spoken_text']=s['title']+'\n\n'+s['text']
(root/'sections.json').write_text(json.dumps(sections,ensure_ascii=False,indent=2)+'\n')
(root/'talk-source.txt').write_text('\n\n'.join(s['spoken_text'] for s in sections)+'\n')
commit='1a2bbf63a0283cd6a7ab0581c43e3a663aa4e82e'
lines=['# Source and rights record','','Topic: the path of a web request, from independent networks to HTTPS.','',f'Source repository: https://github.com/damn-academy/devops-trainer',f'Source commit: `{commit}`','License: Apache-2.0; the repository LICENSE is included as LICENSE.txt.','','The published network lessons store their Markdown in Russian `body: bi(...)` string literals inside TypeScript, rather than standalone .ru.md files. Text and headings below are copied verbatim after decoding string escapes and removing Markdown delimiters, glossary link targets, and fenced code. No translation, paraphrase, widgets, exercises, or quizzes are included. Section order follows the request path. Blank lines are normalized.','','| Section | Source file | Starting line | Section ID | Body words |','|---|---|---:|---|---:|']
for s in sections:lines.append(f"| {s['number']} | `{s['file']}` | {s['line']} | `{s['id']}` | {s['words']} |")
lines+=['',f"Body words (whitespace): {sum(s['words'] for s in sections)}.",f"Spoken words including headings (whitespace): {len((root/'talk-source.txt').read_text().split())}.",'','Slides use only these source headings and source terms, with original HTML/CSS layout and system sans-serif rasterized on macOS. No third-party pictures or embedded font files.','','Audio rights are NOT cleared by the repository license. macOS Tahoe §2F restricts System Voices to personal non-commercial use and excludes public sharing: https://www.apple.com/legal/sla/docs/macOSTahoe.pdf . Milena narration is pending a separately licensed alternative or evidence of additional permission.']
(root/'SOURCE.md').write_text('\n'.join(lines)+'\n')
shutil.copyfile('LICENSE',root/'LICENSE.txt')
style='''*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#132f43;font-family:Arial,Helvetica,sans-serif}main{width:1280px;height:720px;padding:64px 80px;position:relative;border-top:12px solid #147d92}.eyebrow{font-size:21px;letter-spacing:4px;color:#437181}h1{font-size:52px;line-height:1.15;max-width:1100px;margin:64px 0 44px}ul{padding:0;display:flex;gap:18px;flex-wrap:wrap;list-style:none}li{font-size:29px;border:1px solid #bed4da;border-radius:12px;background:white;padding:18px 24px}footer{position:absolute;bottom:43px;left:80px;right:80px;display:flex;justify-content:space-between;font-size:19px;color:#526a77}.progress{position:absolute;bottom:0;left:0;height:7px;background:#147d92}'''
(root/'slides').mkdir(exist_ok=True)
for s in sections:
 page=f'<!doctype html><html lang="ru"><meta charset="utf-8"><title>{html.escape(s["title"])}</title><style>{style}</style><main><div class="eyebrow">DEVOPS / NETWORKS</div><h1>{html.escape(s["title"])}</h1><ul>'+''.join(f'<li>{html.escape(t)}</li>' for t in s['terms'])+f'</ul><footer><span>damn.academy · Apache-2.0</span><span>{s["number"]:02d} / 09</span></footer><div class="progress" style="width:{s["number"]/9*100}%"></div></main></html>'
 (root/'slides'/f'{s["number"]:02d}.html').write_text(page)
print(f'Prepared {len(sections)} sections, {len((root/"talk-source.txt").read_text().split())} spoken words')
