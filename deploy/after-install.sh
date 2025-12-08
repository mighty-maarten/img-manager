#!/bin/bash
set -e

echo "[$(date)] AfterInstall hook started"

# Load NVM for ec2-user
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set working directory
APP_DIR="/opt/img-manager/current"
SHARED_DIR="/opt/img-manager/shared"

echo "[$(date)] Working directory: $APP_DIR"

# Create symlink to shared .env file for API
echo "[$(date)] Creating symlink to shared .env file..."
if [ -f "$SHARED_DIR/.env" ]; then
    ln -sf "$SHARED_DIR/.env" "$APP_DIR/packages/api/.env.production"
    echo "[$(date)] ✓ Symlink created: $APP_DIR/packages/api/.env.production -> $SHARED_DIR/.env"
else
    echo "[$(date)] ⚠ Warning: Shared .env file not found at $SHARED_DIR/.env"
fi

# Replace client environment variables
echo "[$(date)] Replacing client env variables..."
if [ -f "$APP_DIR/packages/client/.env.production" ]; then
    source "$APP_DIR/packages/client/.env.production"
    
    ROOT_DIR="$APP_DIR/packages/client/dist"
    if [ -d "$ROOT_DIR/assets" ]; then
        for file in $ROOT_DIR/assets/index*.js*; do
            if [ -f "$file" ]; then
                echo "[$(date)] Processing $file..."
                sed -i 's|__API_URL__|'${API_URL}'|g' "$file"
            fi
        done
        echo "[$(date)] ✓ Client environment variables replaced"
    else
        echo "[$(date)] ⚠ Warning: Client assets directory not found"
    fi
else
    echo "[$(date)] ⚠ Warning: Client .env.production not found"
fi

# Set correct permissions
echo "[$(date)] Setting file permissions..."
chown -R ec2-user:ec2-user "$APP_DIR"
chmod -R 755 "$APP_DIR"

# Make scripts executable
chmod +x "$APP_DIR/deploy"/*.sh

echo "[$(date)] ✓ AfterInstall hook completed successfully"