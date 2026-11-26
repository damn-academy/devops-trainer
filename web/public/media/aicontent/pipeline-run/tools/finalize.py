"""Generate the report, package, and sibling delivery record without circular ZIP logs."""
import datetime,hashlib,json,shlex,subprocess,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];records=[]
for script in ['write-run.py','package.py']:
 cmd=['python3',str(R/'tools'/script)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
 result=subprocess.run(cmd,check=True)
 records.append(dict(command=shlex.join(cmd),cwd=str(Path.cwd()),start_utc=start,wall_seconds=time.monotonic()-t,exit_code=result.returncode))
files=sorted(p for folder in [R,R.parent/'video-kit'] for p in folder.rglob('*') if p.is_file())
(R.parent/'pipeline-run-inventory.tsv').write_text('file\tbytes\tsha256\n'+''.join(f'{p.relative_to(R.parent)}\t{p.stat().st_size}\t{hashlib.sha256(p.read_bytes()).hexdigest()}\n' for p in files))
(R.parent/'pipeline-run-delivery.json').write_text(json.dumps(dict(commands=records,zip_bytes=(R/'pipeline-run-kit.zip').stat().st_size,zip_sha256=hashlib.sha256((R/'pipeline-run-kit.zip').read_bytes()).hexdigest()),indent=2)+'\n')
