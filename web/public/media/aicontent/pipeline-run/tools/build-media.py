"""Build speech and slides; every external command is timed in commands.jsonl."""
import json, subprocess, tempfile, wave
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def run(*args):
 subprocess.run(['python3',str(R/'tools/measure.py'),*map(str,args)],check=True)
with tempfile.TemporaryDirectory(prefix='pipeline-espeak-') as tmp:
 t=Path(tmp); sections=json.loads((R/'sections.json').read_text()); timeline=[]; pos=0
 for s in sections:
  n=s['number']; txt=t/f'{n:02}.txt'; wav=t/f'{n:02}.wav'; txt.write_text(s['spoken_text'])
  run('espeak-ng','-v','ru','-s','160','-f',txt,'-w',wav)
  with wave.open(str(wav)) as w: dur=w.getnframes()/w.getframerate()
  timeline.append(dict(number=n,start=pos,end=pos+dur,duration=dur));pos+=dur
 (R/'timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
 concat=t/'audio.txt';concat.write_text(''.join(f"file '{t / (str(s['number']).zfill(2)+'.wav')}'\n" for s in sections))
 (R/'01-source').mkdir(exist_ok=True)
 run('ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',concat,'-ar','16000','-ac','1',R/'01-source/audio.wav')
 run('ffmpeg','-v','error','-y','-i',R/'01-source/audio.wav','-ar','48000','-c:a','aac','-b:a','64k',R/'talk.m4a')
 slides=t/'slides.txt';slides.write_text(''.join(f"file '{R}/slides/{s['number']:02}.png'\nduration {s['duration']:.9f}\n" for s in timeline)+f"file '{R}/slides/09.png'\n")
 run('ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',slides,'-i',R/'talk.m4a','-t',str(pos),'-vf','fps=1','-c:v','libx264','-preset','slow','-tune','stillimage','-crf','28','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',R/'talk.mp4')
 (R/'01-source/source.json').write_text(json.dumps(dict(video='../talk.mp4',duration=pos),indent=2)+'\n')
 (R/'frame-requests.txt').write_text('\n\n'.join(f"> IMAGE:\n> ID: slide-{s['number']:02}\n> TIMESTAMP: {s['start']+2:.3f}\n> ALT: {sections[s['number']-1]['title']}" for s in timeline)+'\n')
 print('Speech duration:',pos)
