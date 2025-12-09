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

# Set correct permissions first (CodeDeploy extracts as root)
echo "[$(date)] Setting file permissions..."
sudo chown -R ec2-user:ec2-user "$APP_DIR"
sudo chmod -R 755 "$APP_DIR"

# Merge root node_modules into api node_modules
echo "[$(date)] Merging workspace dependencies..."
if [ -d "$APP_DIR/packages/api/node_modules_root" ]; then
    cp -rn "$APP_DIR/packages/api/node_modules_root/"* "$APP_DIR/packages/api/node_modules/" 2>/dev/null || true
    rm -rf "$APP_DIR/packages/api/node_modules_root"
    echo "[$(date)] ✓ Workspace dependencies merged"
else
    echo "[$(date)] ⚠ Warning: node_modules_root not found"
fi

# Create symlink to shared .env file for API
echo "[$(date)] Creating symlink to shared .env file..."
if [ -f "$SHARED_DIR/.env" ]; then
    ln -sf "$SHARED_DIR/.env" "$APP_DIR/packages/api/.env.production"
    echo "[$(date)] ✓ Symlink created: $APP_DIR/packages/api/.env.production -> $SHARED_DIR/.env"
else
    echo "[$(date)] ⚠ Warning: Shared .env file not found at $SHARED_DIR/.env"
fi

# Native dependencies are already compiled for ARM64 during build
echo "[$(date)] ✓ Native dependencies ready (built on ARM64)"

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

# Make scripts executable
sudo chmod +x "$APP_DIR/deploy"/*.sh

echo "[$(date)] ✓ AfterInstall hook completed successfully"