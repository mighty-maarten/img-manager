#!/bin/bash

echo "[$(date)] ApplicationStop hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if PM2 is running any processes
# Don't fail if no processes are running (first deployment)
if pm2 list 2>/dev/null | grep -q "online"; then
    echo "[$(date)] Stopping PM2 processes..."
    pm2 stop all || true
    echo "[$(date)] ✓ PM2 processes stopped"
else
    echo "[$(date)] No PM2 processes running (this is normal for first deployment)"
fi

echo "[$(date)] ✓ ApplicationStop hook completed successfully"
exit 0
