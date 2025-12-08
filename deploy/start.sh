#!/bin/bash
set -e

echo "[$(date)] ApplicationStart hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set working directory
APP_DIR="/opt/img-manager/current"
SHARED_DIR="/opt/img-manager/shared"

echo "[$(date)] Working directory: $APP_DIR"
cd "$APP_DIR"

# Verify .env file exists
if [ ! -f "$SHARED_DIR/.env" ]; then
    echo "[$(date)] ✗ Error: Environment file not found at $SHARED_DIR/.env"
    exit 1
fi

# Start application with PM2
echo "[$(date)] Starting application with PM2..."
if pm2 start deploy/app-start.config.js; then
    echo "[$(date)] ✓ Application started successfully"
    pm2 save
    echo "[$(date)] ✓ PM2 process list saved"
else
    echo "[$(date)] ✗ Error: Failed to start application"
    exit 1
fi

# Show PM2 status
pm2 list

echo "[$(date)] ✓ ApplicationStart hook completed successfully"
