#!/bin/bash
# merge-env.sh - Merge build-time environment config with runtime secrets
# This script retrieves database credentials from AWS Secrets Manager and
# merges them with the build-time .env.build file to create .env.production
#
# Requirements: 2.1, 2.2, 2.3, 5.1, 5.2

set -e

# Logging function with timestamps
log() {
    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"
}

# Error handling function
error_exit() {
    log "✗ ERROR: $1"
    exit 1
}

log "Starting environment configuration merge..."

# Configuration
APP_DIR="/opt/img-manager/current"
SHARED_DIR="/opt/img-manager/shared"
ENV_BUILD_FILE="$APP_DIR/packages/api/.env.build"
ENV_PRODUCTION_FILE="$SHARED_DIR/.env.production"
SECRETS_CONFIG_FILE="$SHARED_DIR/secrets-config.sh"

# Load secrets configuration (DB_SECRET_ARN and AWS_REGION)
# First try to load from secrets-config.sh, then fall back to environment variables
if [ -f "$SECRETS_CONFIG_FILE" ]; then
    log "Loading secrets configuration from $SECRETS_CONFIG_FILE..."
    source "$SECRETS_CONFIG_FILE"
elif [ -n "$DB_SECRET_ARN" ] && [ -n "$AWS_REGION" ]; then
    log "Using secrets configuration from environment variables..."
else
    # Try to extract from existing .env.production if it exists (backward compatibility)
    if [ -f "$SHARED_DIR/.env.production" ]; then
        log "Extracting AWS_REGION from existing .env.production..."
        AWS_REGION=$(grep "^AWS_REGION=" "$SHARED_DIR/.env.production" | cut -d'=' -f2)
    fi
    
    # Check if we have the required variables now
    if [ -z "$DB_SECRET_ARN" ] || [ -z "$AWS_REGION" ]; then
        error_exit "Secrets configuration not found. Expected either:
  1. $SECRETS_CONFIG_FILE file with DB_SECRET_ARN and AWS_REGION
  2. DB_SECRET_ARN and AWS_REGION environment variables"
    fi
fi

# Validate required environment variables
if [ -z "$DB_SECRET_ARN" ]; then
    error_exit "DB_SECRET_ARN is not set in secrets configuration"
fi

if [ -z "$AWS_REGION" ]; then
    error_exit "AWS_REGION is not set in secrets configuration"
fi

log "Configuration loaded:"
log "  DB_SECRET_ARN: $DB_SECRET_ARN"
log "  AWS_REGION: $AWS_REGION"

# Verify .env.build file exists
if [ ! -f "$ENV_BUILD_FILE" ]; then
    error_exit ".env.build not found in deployment artifact at $ENV_BUILD_FILE"
fi

log "✓ Found .env.build file at $ENV_BUILD_FILE"

# Retrieve database credentials from Secrets Manager
log "Retrieving database credentials from AWS Secrets Manager..."
DB_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "$DB_SECRET_ARN" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>&1) || error_exit "Failed to retrieve database credentials from Secrets Manager: $DB_SECRET"

# Parse credentials from JSON
DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username') || error_exit "Failed to parse username from secret"
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password') || error_exit "Failed to parse password from secret"
DB_NAME=$(echo "$DB_SECRET" | jq -r '.dbname') || error_exit "Failed to parse dbname from secret"

# Validate parsed credentials
if [ -z "$DB_USERNAME" ] || [ "$DB_USERNAME" = "null" ]; then
    error_exit "Database username is empty or null"
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
    error_exit "Database password is empty or null"
fi

if [ -z "$DB_NAME" ] || [ "$DB_NAME" = "null" ]; then
    error_exit "Database name is empty or null"
fi

log "✓ Database credentials retrieved successfully"

# Generate JWT secret
log "Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 32) || error_exit "Failed to generate JWT secret"
log "✓ JWT secret generated"

# Create merged .env.production file
log "Creating merged .env.production file..."

# Start with build-time configuration
cat "$ENV_BUILD_FILE" > "$ENV_PRODUCTION_FILE" || error_exit "Failed to copy .env.build to .env.production"

# Append runtime secrets
cat >> "$ENV_PRODUCTION_FILE" << EOF

# Runtime Secrets (from AWS Secrets Manager)
# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=${DB_NAME}
DATABASE_USERNAME=${DB_USERNAME}
DATABASE_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF

if [ $? -ne 0 ]; then
    error_exit "Failed to append runtime secrets to .env.production"
fi

log "✓ Merged configuration file created at $ENV_PRODUCTION_FILE"

# Set secure file permissions (owner read/write only)
log "Setting secure file permissions..."
chown ec2-user:ec2-user "$ENV_PRODUCTION_FILE" || error_exit "Failed to set file ownership"
chmod 600 "$ENV_PRODUCTION_FILE" || error_exit "Failed to set file permissions"

# Verify permissions
PERMS=$(stat -c "%a" "$ENV_PRODUCTION_FILE")
if [ "$PERMS" != "600" ]; then
    error_exit "File permissions verification failed. Expected 600, got $PERMS"
fi

log "✓ File permissions set to 600 (owner read/write only)"

# Run validation
log "Validating merged configuration..."
source "$(dirname "$0")/validate-env.sh"

if validate_env_file "$ENV_PRODUCTION_FILE"; then
    log "✓ Configuration validation passed"
else
    error_exit "Configuration validation failed"
fi

log "✓ Environment configuration merge completed successfully"
