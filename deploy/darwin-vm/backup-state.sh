#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/railstats"
STATE_DIR="${REPO_DIR}/darwin-local-test/state"
TMP_DIR="/tmp"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${TMP_DIR}/darwin-state-${STAMP}.tar.gz"

# Update to the exact bucket/prefix you want for backups.
BACKUP_URI="${BACKUP_URI:-gs://rail-statistics.firebasestorage.app/darwin-state-backups}"

if [[ ! -d "${STATE_DIR}" ]]; then
  echo "Missing state directory: ${STATE_DIR}"
  exit 1
fi

if ! command -v gsutil >/dev/null 2>&1; then
  echo "gsutil not found. Install google-cloud-cli first."
  exit 1
fi

tar -C "${STATE_DIR}" -czf "${ARCHIVE}" .
gsutil cp "${ARCHIVE}" "${BACKUP_URI}/"
rm -f "${ARCHIVE}"

echo "Backup complete: ${BACKUP_URI}/$(basename "${ARCHIVE}")"
