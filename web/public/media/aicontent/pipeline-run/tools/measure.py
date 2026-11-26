"""Run one command and append its exact argv, status and wall time to the audit log."""
import datetime,json,shlex,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
t=time.perf_counter()
result=subprocess.run(sys.argv[1:])
record=dict(start_utc=start,command=shlex.join(sys.argv[1:]),cwd=str(Path.cwd()),wall_seconds=round(time.perf_counter()-t,6),exit_code=result.returncode)
with (root/'commands.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
raise SystemExit(result.returncode)
