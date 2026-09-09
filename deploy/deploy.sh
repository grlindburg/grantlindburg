#!/usr/bin/env bash
# Redeploy latest main on the droplet. Run from your machine:
#   ./deploy/deploy.sh root@<droplet-ip>
set -euo pipefail

TARGET="${1:?usage: deploy.sh user@host}"
ssh "$TARGET" 'cd /opt/grantlindburg && git pull --ff-only && docker compose up -d --build && docker image prune -f'
