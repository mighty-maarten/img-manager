#!/bin/bash

echo "[$(date)] ApplicationStart hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set working directory
APP_DIR="/opt/img-manager/current"
SHARED_DIR="/opt/img-manager/shared"

echo "[$(date)] Working directory: $APP_DIR"
cd "$APP_DIR" || {
    echo "[$(date)] ✗ Error: Failed to change to directory $APP_DIR"
    exit 1
}

# Verify .env.production file exists
if [ ! -f "$SHARED_DIR/.env.production" ]; then
    echo "[$(date)] ✗ Error: Environment file not found at $SHARED_DIR/.env.production"
    exit 1
fi

# Delete old PM2 processes if any
echo "[$(date)] Cleaning up old PM2 processes..."
pm2 delete all 2>/dev/null || echo "[$(date)] No existing PM2 processes to delete"

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
exit 0
