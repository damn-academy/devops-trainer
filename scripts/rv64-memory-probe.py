#!/usr/bin/env python3
"""Add memory telemetry to a retained probe without replacing its opt-ins."""
import os
from pathlib import Path

MARKER = '  echo RV64_READYZ_BEGIN\n'
BLOCK = '''  # RV64_MEM_PROBE_V1: baseline immediately after readyz, then every 60 guest seconds.
  (
    while :; do
      /bin/busybox awk '
        FILENAME == "/proc/uptime" { uptime = $1; next }
        FILENAME == "/proc/meminfo" &&
          ($1 == "MemAvailable:" || $1 == "Cached:" ||
           $1 == "Active(file):" || $1 == "Inactive(file):") {
          key = $1; sub(/:$/, "", key)
          printf "RV64_MEM uptime=%s %s=%s kB\\n", uptime, key, $2
        }
        FILENAME == "/proc/vmstat" &&
          ($1 == "pgmajfault" || $1 == "workingset_refault_file" ||
           $1 ~ /^pgscan/ || $1 ~ /^pgsteal/) {
          printf "RV64_MEM uptime=%s %s=%s\\n", uptime, $1, $2
        }
      ' /proc/uptime /proc/meminfo /proc/vmstat
      /bin/busybox sleep 60
    done
  ) &
'''


def instrument(text):
    if '# RV64_MEM_PROBE_V1:' in text:
        return text
    if text.count(MARKER) != 1:
        raise ValueError('expected exactly one retained RV64_READYZ_BEGIN marker')
    # Keep the original uptime/cmdline adjacent to readyz for existing parsers.
    anchor = MARKER + '  /bin/busybox cat /proc/uptime /proc/cmdline\n'
    if text.count(anchor) != 1:
        raise ValueError('unknown readyz layout; inspect before patching')
    return text.replace(anchor, anchor + BLOCK, 1)


if __name__ == '__main__':
    assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
    path = Path(os.environ['RV64_PROBE_ROOT']) / 'usr/share/kuberoot/rv64-probe.sh'
    path.write_text(instrument(path.read_text()))
    print('Installed RV64_MEM telemetry; retained probe settings preserved')
