"""Check delivered media, segment/chunk integrity, exact stream preservation and archive."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
v=probe(R/'talk.mp4');a=probe(R/'talk.m4a')
assert (R/'talk.mp4').stat().st_size<30_000_000
assert 1140<=float(v['format']['duration'])<=1380
assert next(s for s in a['streams'] if s['codec_type']=='audio')['sample_rate']=='48000'
assert next(s for s in v['streams'] if s['codec_type']=='video')['codec_name']=='h264'
timeline=json.loads((R/'timeline.json').read_text());assert abs(float(a['format']['duration'])-timeline[-1]['end'])<.01
segments=json.loads((R/'02-transcript/transcript.json').read_text())['segments']
chunks=json.loads((R/'03-chunks/manifest.json').read_text());assert sum(c['segments'] for c in chunks)==len(segments)
assert len(json.loads((R/'frames/frames.json').read_text()))==len(timeline)==9
stats=json.loads((R/'asr-stats.json').read_text());assert stats['distance']==sum(stats[k] for k in ['substitutions','deletions','insertions'])
kit=R.parent/'video-kit'
for name in ['before','after']:
 p=kit/f'{name}.mp4';assert float(probe(p)['format']['duration'])==17
 old=subprocess.check_output(['git','show',f'a102d0b:web/public/media/aicontent/video-kit/{name}.mp4'])
 import tempfile
 with tempfile.NamedTemporaryFile(suffix='.mp4') as f:
  f.write(old);f.flush()
  def h(x):return subprocess.check_output(['ffmpeg','-v','error','-i',str(x),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-'])
  assert h(f.name)==h(p)
for p in kit.glob('subtitles-*.srt'):
 assert p.read_bytes()==subprocess.check_output(['git','show',f'a102d0b:{p.relative_to(Path.cwd())}'])
assert not list(R.rglob('*.aiff'))
changed=subprocess.check_output(['git','diff','--name-only','a102d0b','--','*.ru.md'],text=True)
assert not changed
assert not subprocess.check_output(['git','-C',str(Path.home()/'projects/video-to-article'),'status','--porcelain'],text=True)
print(json.dumps(dict(talk_duration=v['format']['duration'],audio_duration=a['format']['duration'],talk_bytes=(R/'talk.mp4').stat().st_size,chunks=len(chunks),frames=9,wer=stats['wer'],clip_durations_unchanged=True),indent=2))
