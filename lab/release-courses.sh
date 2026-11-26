#!/bin/sh
# Package an existing cluster build. Never builds or copies web/public.
set -eu
exec python3 "$(dirname "$0")/packaging/courses.py" "$@"
