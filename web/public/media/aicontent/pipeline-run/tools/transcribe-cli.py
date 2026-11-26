"""Inject a whisper-cli backend into the unchanged plugin CLI and use its writers."""
import importlib.util,json,subprocess,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
plugin=Path.home()/'projects/video-to-article/skills/video-to-article/scripts/transcribe.py'
spec=importlib.util.spec_from_file_location('plugin_transcribe',plugin);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def backend(wav,model,language,detect_only):
 assert not detect_only
 out=R/'02-transcript';out.mkdir(exist_ok=True)
 cmd=['whisper-cli','-m',str(Path(model).expanduser()),'-f',str(wav),'-l',language,'-tp','0','-tpi','0','-nf','-mc','0','-oj','-of',str(out/'whisper-raw')]
 with (out/'whisper-cli.log').open('w') as log:
  subprocess.run(['python3',str(R/'tools/measure.py'),*cmd],stdout=log,stderr=subprocess.STDOUT,check=True)
 data=json.loads((out/'whisper-raw.json').read_text())
 return language,[dict(start=s['offsets']['from']/1000,end=s['offsets']['to']/1000,text=s['text'].strip(),words=[]) for s in data['transcription']]
mod.BACKENDS['whisper-cli']=('subprocess',backend)
mod.pick_backend=lambda name: ('whisper-cli',backend)
sys.argv=[str(plugin),str(R),'--model',str(Path.home()/'whisper-models/ggml-large-v3-turbo.bin'),'--language','ru','--backend','whisper-cli']
mod.main()
