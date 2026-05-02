#!/usr/bin/env bash
# One-time (or occasional) fix: if timetable files were written by root cron,
# chown them so User=railstats can read them. Does not download timetables.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/railstats}"
TT_ROOT="${REPO_DIR}/darwin-local-test/tt"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if [[ ! -d "$TT_ROOT" ]]; then
  echo "Nothing to fix: missing $TT_ROOT"
  exit 0
fi

chown -R railstats:railstats "$TT_ROOT"
echo "Updated ownership: $TT_ROOT -> railstats:railstats"
