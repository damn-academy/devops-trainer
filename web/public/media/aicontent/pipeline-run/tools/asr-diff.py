"""Exact word Levenshtein alignment; punctuation differences do not affect WER."""
import collections,csv,json,re,unicodedata
from array import array
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def tokens(text,ts=0):
 text=unicodedata.normalize('NFC',text)
 matches=list(re.finditer(r'[^\W_]+',text,re.UNICODE))
 return [(m.group().lower(),text[m.start():matches[i+1].start() if i+1<len(matches) else len(text)].strip(),ts) for i,m in enumerate(matches)]
a=tokens((R/'talk-source.txt').read_text());b=[]
for s in json.loads((R/'02-transcript/transcript.json').read_text())['segments']:b+=tokens(s['text'],s['start'])
n,m=len(a),len(b);dp=[array('I',range(m+1))]
for i in range(1,n+1):
 row=array('I',[i]+[0]*m)
 for j in range(1,m+1):row[j]=min(dp[-1][j]+1,row[j-1]+1,dp[-1][j-1]+(a[i-1][0]!=b[j-1][0]))
 dp.append(row)
i,j=n,m;ops=[]
while i or j:
 if i and j and dp[i][j]==dp[i-1][j-1]+(a[i-1][0]!=b[j-1][0]):
  ops.append(('equal' if a[i-1][0]==b[j-1][0] else 'substitution',i-1,j-1));i-=1;j-=1
 elif i and dp[i][j]==dp[i-1][j]+1:ops.append(('deletion',i-1,j));i-=1
 else:ops.append(('insertion',i,j-1));j-=1
ops.reverse();rows=[];counts=collections.Counter();pairs=collections.Counter()
terms=set(re.findall(r'[a-z]+', (R/'talk-source.txt').read_text().lower()))
def category(x,y):
 if any(c.isdigit() for c in x+y):return 'number'
 if any(t in terms for t in re.findall(r'[a-z]+',(x+' '+y).lower())):return 'term'
 if any(t in (x+' '+y).lower() for t in ['nginx','cloudflare','google','linux','iana','chrome']):return 'name'
 return 'other'
for op,i,j in ops:
 x=a[i][1] if op!='insertion' else '';y=b[j][1] if op!='deletion' else ''
 if op=='equal':
  # Compare punctuation only, ignoring case and whitespace.
  if re.sub(r'[\w\s]','',x)==re.sub(r'[\w\s]','',y):continue
  cat='punctuation'
 else:
  counts[op]+=1;cat=category(x,y);pairs[(x,y,cat)]+=1
 t=b[min(j,m-1)][2];stamp=f'{int(t)//3600:02}:{int(t)%3600//60:02}:{t%60:06.3f}'
 rows.append([stamp,x,y,cat])
with (R/'asr-diff.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t');w.writerow(['timestamp','source fragment','transcript fragment','category guess']);w.writerows(rows)
stats=dict(source_words=n,transcript_words=m,substitutions=counts['substitution'],deletions=counts['deletion'],insertions=counts['insertion'],distance=dp[n][m],wer=dp[n][m]/n,normalization='Unicode NFC, lowercase, Unicode letter/digit runs; punctuation removed, ё retained; no numeral or acronym expansion',timestamp_precision='Whisper segment start; deletions use next hypothesis token or final segment',alignment='Unit-cost Levenshtein; tie break diagonal, deletion, insertion',mismatch_rows=len(rows),top_20=[dict(source=x,transcript=y,category=c,count=k) for (x,y,c),k in pairs.most_common(20)])
assert stats['distance']==sum(counts.values());assert n-counts['deletion']+counts['insertion']==m
(R/'asr-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n');print(json.dumps(stats,ensure_ascii=False,indent=2))
