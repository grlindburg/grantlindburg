#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 DigitalOcean droplet.
# Run as root:  bash droplet-setup.sh <git-clone-url>
set -euo pipefail

REPO_URL="${1:?usage: droplet-setup.sh <git-clone-url>}"
APP_DIR=/opt/grantlindburg

apt-get update
apt-get install -y ca-certificates curl git ufw

# Docker (official convenience script)
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Firewall: SSH + HTTP/HTTPS only
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Clone and start
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
docker compose up -d --build

echo "Done. Site will be live at https://grantlindburg.com once DNS points here."
