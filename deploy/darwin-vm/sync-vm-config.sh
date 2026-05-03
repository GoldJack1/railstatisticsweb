#!/usr/bin/env bash
# Install systemd unit, Caddyfile, and cron.d snippets from the repo (run as root).
# Called by setup.sh (bootstrap) and update.sh (deploy).
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/railstats}"
SERVICE_NAME="${SERVICE_NAME:-darwin-daemon}"
SYSTEMD_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "Missing git repo at ${REPO_DIR}"
  exit 1
fi

install -d -o railstats -g railstats -m 0755 "${REPO_DIR}/darwin-local-test/logs"

install -m 0644 "${REPO_DIR}/deploy/darwin-vm/darwin-daemon.service" "${SYSTEMD_FILE}"
install -m 0644 "${REPO_DIR}/deploy/darwin-vm/Caddyfile" /etc/caddy/Caddyfile
install -m 0644 "${REPO_DIR}/deploy/darwin-vm/darwin-fetch.cron" /etc/cron.d/darwin-fetch
install -m 0644 "${REPO_DIR}/deploy/darwin-vm/darwin-weekly-check.cron" /etc/cron.d/darwin-weekly-check
install -m 0644 "${REPO_DIR}/deploy/darwin-vm/darwin-health-watchdog.cron" /etc/cron.d/darwin-health-watchdog

systemctl daemon-reload

if command -v caddy >/dev/null 2>&1; then
  caddy validate --config /etc/caddy/Caddyfile
  if systemctl is-active --quiet caddy 2>/dev/null; then
    systemctl reload caddy
  fi
fi

echo "VM config synced from ${REPO_DIR} (systemd + Caddy + cron.d)."
