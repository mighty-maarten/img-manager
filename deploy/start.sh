#!/bin/bash
# start.sh - Application start script for CodeDeploy ApplicationStart hook
# This script verifies the merged .env.production exists and starts the application
#
# Requirements: 2.4

echo "[$(date)] ApplicationStart hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set working directory
APP_DIR="/opt/img-manager/current"
SHARED_DIR="/opt/img-manager/shared"
ENV_PRODUCTION_FILE="$SHARED_DIR/.env.production"

echo "[$(date)] Working directory: $APP_DIR"
cd "$APP_DIR" || {
    echo "[$(date)] ✗ Error: Failed to change to directory $APP_DIR"
    exit 1
}

# Verify merged .env.production file exists
# This file should have been created by merge-env.sh during the AfterInstall hook
# It contains both build-time variables (from .env.build) and runtime secrets (from Secrets Manager)
echo "[$(date)] Verifying merged environment configuration..."
if [ ! -f "$ENV_PRODUCTION_FILE" ]; then
    echo "[$(date)] ✗ ERROR: Merged environment file not found at $ENV_PRODUCTION_FILE"
    echo "[$(date)]   This file should have been created by merge-env.sh during deployment."
    echo "[$(date)]   Possible causes:"
    echo "[$(date)]     1. The AfterInstall hook (after-install.sh) did not run successfully"
    echo "[$(date)]     2. The merge-env.sh script failed to create the merged configuration"
    echo "[$(date)]     3. The .env.build file was missing from the deployment artifact"
    echo "[$(date)]     4. AWS Secrets Manager credentials could not be retrieved"
    echo "[$(date)]   Check the CodeDeploy deployment logs for more details."
    exit 1
fi

# Verify the file is readable
if [ ! -r "$ENV_PRODUCTION_FILE" ]; then
    echo "[$(date)] ✗ ERROR: Environment file exists but is not readable: $ENV_PRODUCTION_FILE"
    echo "[$(date)]   Check file permissions and ownership."
    exit 1
fi

# Verify the file is not empty
if [ ! -s "$ENV_PRODUCTION_FILE" ]; then
    echo "[$(date)] ✗ ERROR: Environment file exists but is empty: $ENV_PRODUCTION_FILE"
    echo "[$(date)]   The merge-env.sh script may have failed during configuration generation."
    exit 1
fi

echo "[$(date)] ✓ Merged environment configuration verified at $ENV_PRODUCTION_FILE"

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
