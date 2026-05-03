#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/railstats"
SERVICE_NAME="darwin-daemon"
ENV_FILE="/etc/darwin-daemon.env"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

echo "[1/8] Installing packages"
apt-get update -y
apt-get install -y curl ca-certificates gnupg git cron rsync

echo "[2/8] Installing Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[3/8] Installing gcloud SDK and gsutil"
if ! command -v gcloud >/dev/null 2>&1; then
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" >/etc/apt/sources.list.d/google-cloud-sdk.list
  curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
  apt-get update -y
  apt-get install -y google-cloud-cli
fi

echo "[4/8] Installing Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "[5/8] Ensuring railstats user exists"
if ! id -u railstats >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash railstats
fi

echo "[6/8] Installing dependencies in repo"
if [[ ! -d "${REPO_DIR}" ]]; then
  echo "Missing ${REPO_DIR}. Clone repo first, then re-run."
  exit 1
fi
cd "${REPO_DIR}"
npm --prefix darwin-local-test install

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it from deploy/darwin-vm/env.example first."
  exit 1
fi

echo "[7/8] Installing systemd, Caddy, and cron snippets from repo"
REPO_DIR="${REPO_DIR}" bash "${REPO_DIR}/deploy/darwin-vm/sync-vm-config.sh"
chown -R railstats:railstats "${REPO_DIR}"

echo "[8/8] Enabling services"
systemctl enable --now "${SERVICE_NAME}"
systemctl enable --now caddy

echo "Done."
echo "Verify daemon: systemctl status ${SERVICE_NAME} --no-pager"
echo "Verify health: curl http://127.0.0.1:4001/api/health"
echo "Verify ping (uptime monitors): curl http://127.0.0.1:4001/api/ping"
