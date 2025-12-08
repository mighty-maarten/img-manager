#!/bin/bash
set -e

echo "[$(date)] ApplicationStop hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if PM2 is running any processes
if pm2 list | grep -q "online"; then
    echo "[$(date)] Stopping PM2 processes..."
    pm2 stop all
    echo "[$(date)] ✓ PM2 processes stopped"
else
    echo "[$(date)] No PM2 processes running"
fi

echo "[$(date)] ✓ ApplicationStop hook completed successfully"
