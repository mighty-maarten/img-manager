#!/bin/bash

echo "[$(date)] ApplicationStop hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if PM2 has any processes
PM2_PROCESS_COUNT=$(pm2 list 2>/dev/null | grep -c "online" || echo "0")

if [ "$PM2_PROCESS_COUNT" -gt 0 ]; then
    echo "[$(date)] Stopping $PM2_PROCESS_COUNT PM2 process(es)..."
    pm2 stop all 2>&1 || echo "[$(date)] Warning: Some processes may have already stopped"
    echo "[$(date)] ✓ PM2 processes stopped"
else
    echo "[$(date)] No PM2 processes running (this is normal for first deployment)"
fi

echo "[$(date)] ✓ ApplicationStop hook completed successfully"
exit 0
