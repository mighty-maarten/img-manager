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

# Create symlink for .env.production in API directory
echo "[$(date)] Creating .env.production symlink for application..."
API_DIR="$APP_DIR/packages/api"
if [ -d "$API_DIR" ]; then
    ln -sf "$SHARED_DIR/.env.production" "$API_DIR/.env.production"
    echo "[$(date)] ✓ .env.production symlink created at $API_DIR/.env.production"
else
    echo "[$(date)] ⚠ Warning: API directory not found at $API_DIR, symlink will be created during deployment"
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

# Run post-deployment Nginx configuration check
echo "[$(date)] Running post-deployment Nginx configuration check..."
if [ -f "/opt/img-manager/shared/update-nginx-for-app.sh" ]; then
    /opt/img-manager/shared/update-nginx-for-app.sh
else
    echo "[$(date)] ⚠ Post-deployment script not found, skipping Nginx check"
fi

echo "[$(date)] ✓ ApplicationStart hook completed successfully"
exit 0
