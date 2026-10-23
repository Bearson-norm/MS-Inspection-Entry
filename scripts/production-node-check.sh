#!/usr/bin/env bash
# Run on the PM2 host (CRS + Inspection) after SSH:
#   bash scripts/production-node-check.sh
set -euo pipefail
echo "=== Node runtime (Oct 2026 security baseline) ==="
node -v
npm run verify-node
echo ""
echo "=== PM2 processes (adjust names if different) ==="
if command -v pm2 >/dev/null 2>&1; then
  pm2 list
  echo ""
  echo "After upgrading Node, restart:"
  echo "  pm2 restart ms-inspection-entry"
  echo "  pm2 restart <crs-app-name>"
else
  echo "pm2 not in PATH; restart Node apps manually after upgrade."
fi
