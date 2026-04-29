#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/railstats"
SERVICE_NAME="darwin-daemon"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "Missing git repo at ${REPO_DIR}"
  exit 1
fi

cd "${REPO_DIR}"
git pull --ff-only
npm --prefix darwin-local-test install
systemctl restart "${SERVICE_NAME}"

echo "Update complete."
systemctl --no-pager --full status "${SERVICE_NAME}" | sed -n '1,20p'
