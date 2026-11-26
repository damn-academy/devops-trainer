"""Replace narration without changing compressed video packets or timeline anchors."""
import hashlib,json,re,shlex,subprocess,tempfile,time,wave
from pathlib import Path
R=Path(__file__).resolve().parent
records=[]
def run(*args):
 t=time.monotonic();p=subprocess.run(list(map(str,args)),check=True,capture_output=True)
 records.append(dict(command=shlex.join(list(map(str,args))),wall_seconds=time.monotonic()-t));return p.stdout
def probe(p):return json.loads(run('ffprobe','-v','error','-show_streams','-show_format','-of','json',p))
def video_hash(p):return run('ffmpeg','-v','error','-i',p,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-').decode().strip()
# Original AAC durations in samples at 44100 Hz, pinned before replacement.
targets=[247798,165199,243123]
report={'lines':[],'clips':[]}
with tempfile.TemporaryDirectory(prefix='video-kit-espeak-') as tmp:
 t=Path(tmp)
 for i,line in enumerate((R/'script.txt').read_text().splitlines(),1):
  txt=t/f'line-{i}.txt';wav=t/f'line-{i}.wav';txt.write_text(re.sub(r'^\d+\. ','',line))
  run('espeak-ng','-v','ru','-s','160','-f',txt,'-w',wav)
  with wave.open(str(wav)) as w:duration=w.getnframes()/w.getframerate()
  target=targets[i-1]/44100
  assert duration<=target,'Only silence may be trimmed'
  run('ffmpeg','-v','error','-y','-i',wav,'-af',f'aresample=44100,apad,atrim=end_sample={targets[i-1]}','-c:a','aac','-b:a','96k',R/f'line-{i}.m4a')
  report['lines'].append(dict(line=i,raw_seconds=duration,padded_seconds=target,encoded_seconds=float(probe(R/f'line-{i}.m4a')['format']['duration'])))
 for name,anchors in [('before',[0,4000,8000]),('after',[300,6200,10400])]:
  p=R/f'{name}.mp4';old=probe(p);h=video_hash(p);out=t/p.name
  args=['ffmpeg','-v','error','-y','-i',p]
  for i in range(1,4):args+=['-i',R/f'line-{i}.m4a']
  filters=';'.join(f'[{i+1}:a]adelay={ms}:all=1[a{i}]' for i,ms in enumerate(anchors))+';[a0][a1][a2]amix=inputs=3:normalize=0,apad,atrim=duration=17[a]'
  run(*args,'-filter_complex',filters,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','96k','-movflags','+faststart',out)
  new=probe(out);assert video_hash(out)==h;assert new['format']['duration']==old['format']['duration']
  report['clips'].append(dict(file=p.name,before_duration=old['format']['duration'],after_duration=new['format']['duration'],video_sha256=h,anchors_ms=anchors))
  out.replace(p)
report['commands']=records
(R/'revoice-report.json').write_text(json.dumps(report,indent=2)+'\n')
