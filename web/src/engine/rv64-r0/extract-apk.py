"""Extract the data part of Alpine .apk packages (concatenated gzip tar streams)
into a root directory. Usage: python3 -I extract-apk.py ROOT PKG.apk..."""
import sys, tarfile, os

root = os.path.realpath(sys.argv[1])
for pkg in sys.argv[2:]:
    with tarfile.open(pkg, mode="r:gz", ignore_zeros=True) as tf:
        members = [m for m in tf.getmembers() if not m.name.startswith(".")]
        tf.extractall(root, members=members, filter="data")
    print("extracted", os.path.basename(pkg), len(members), "entries")
