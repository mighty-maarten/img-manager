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

# Extract node_modules from tarball
echo "[$(date)] Extracting node_modules from tarball..."
if [ -f "$APP_DIR/node_modules.tar.gz" ]; then
    cd "$APP_DIR"
    tar -xzf node_modules.tar.gz
    rm node_modules.tar.gz
    echo "[$(date)] ✓ node_modules extracted successfully"
else
    echo "[$(date)] ✗ ERROR: node_modules.tar.gz not found!"
    exit 1
fi

# Verify node_modules exist (workspace setup - dependencies in root)
echo "[$(date)] Verifying dependencies..."
if [ -d "$APP_DIR/node_modules" ]; then
    echo "[$(date)] ✓ Dependencies found in root node_modules (workspace setup)"
else
    echo "[$(date)] ✗ ERROR: node_modules not found after extraction!"
    exit 1
fi

# Merge build-time config with runtime secrets
echo "[$(date)] Merging environment configuration..."
if [ -f "$APP_DIR/deploy/merge-env.sh" ]; then
    # Make merge script executable
    chmod +x "$APP_DIR/deploy/merge-env.sh"
    chmod +x "$APP_DIR/deploy/validate-env.sh"
    
    # Run the merge script
    if "$APP_DIR/deploy/merge-env.sh"; then
        echo "[$(date)] ✓ Environment configuration merged successfully"
        
        # Create symlink from API directory to shared .env.production
        ln -sf "$SHARED_DIR/.env.production" "$APP_DIR/packages/api/.env.production"
        echo "[$(date)] ✓ Symlink created: $APP_DIR/packages/api/.env.production -> $SHARED_DIR/.env.production"
    else
        echo "[$(date)] ✗ ERROR: Failed to merge environment configuration"
        exit 1
    fi
else
    echo "[$(date)] ✗ ERROR: merge-env.sh not found in deployment artifact"
    exit 1
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