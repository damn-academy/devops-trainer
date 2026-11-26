"""Archive all kit files except talk.mp4, the regenerable 16 kHz audio.wav and the archive itself; verify every byte."""
import hashlib,json,zipfile,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];z=R/'pipeline-run-kit.zip'
files=[p for p in sorted(R.rglob('*')) if p.is_file() and p!=z and p!=R/'talk.mp4' and p.name not in ('audio.wav','.gitignore')]
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as out:
 for p in files:out.write(p,p.relative_to(R))
with zipfile.ZipFile(z) as out:
 assert out.testzip() is None
 assert set(out.namelist())=={str(p.relative_to(R)) for p in files}
 for p in files:assert out.read(str(p.relative_to(R)))==p.read_bytes()
print(f'{len(files)} files; ZIP {z.stat().st_size} bytes; byte-for-byte verification passed')
