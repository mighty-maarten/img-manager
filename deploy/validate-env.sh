#!/bin/bash
# validate-env.sh - Validate that the environment configuration file contains all required variables
# This script checks that both build-time and runtime variables are present
#
# Requirements: 5.3, 5.4

# Logging function with timestamps
log() {
    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"
}

# Required build-time variables (from .env.build)
REQUIRED_BUILD_VARS=(
    "NODE_ENV"
    "APP_PORT"
    "APP_ALLOWED_ORIGINS"
    "APP_IS_CLOUD"
    "APP_CLOUDWATCH_LOG_GROUP_NAME"
    "APP_SNS_ERROR_TOPIC_ARN"
    "APP_ASSETS_BUCKET_NAME"
    "APP_LOCAL_STORAGE_PATH"
    "AWS_REGION"
    "DOMAIN_NAME"
)

# Required runtime variables (from Secrets Manager)
REQUIRED_RUNTIME_VARS=(
    "DATABASE_HOST"
    "DATABASE_PORT"
    "DATABASE_NAME"
    "DATABASE_USERNAME"
    "DATABASE_PASSWORD"
    "JWT_SECRET"
)

# Function to check if a variable is defined and non-empty in a file
check_variable() {
    local file="$1"
    local var_name="$2"
    
    # Check if variable exists in file (with or without quotes)
    if grep -qE "^${var_name}=.+" "$file"; then
        return 0
    else
        return 1
    fi
}

# Main validation function
# Usage: validate_env_file <path_to_env_file>
# Returns: 0 if valid, 1 if invalid
validate_env_file() {
    local env_file="$1"
    local missing_vars=()
    local validation_passed=true
    
    if [ -z "$env_file" ]; then
        log "✗ ERROR: No environment file path provided"
        return 1
    fi
    
    if [ ! -f "$env_file" ]; then
        log "✗ ERROR: Environment file not found: $env_file"
        return 1
    fi
    
    log "Validating environment file: $env_file"
    
    # Check build-time variables
    log "Checking build-time variables..."
    for var in "${REQUIRED_BUILD_VARS[@]}"; do
        if check_variable "$env_file" "$var"; then
            log "  ✓ $var is set"
        else
            log "  ✗ $var is MISSING"
            missing_vars+=("$var (build-time)")
            validation_passed=false
        fi
    done
    
    # Check runtime variables
    log "Checking runtime variables..."
    for var in "${REQUIRED_RUNTIME_VARS[@]}"; do
        if check_variable "$env_file" "$var"; then
            log "  ✓ $var is set"
        else
            log "  ✗ $var is MISSING"
            missing_vars+=("$var (runtime)")
            validation_passed=false
        fi
    done
    
    # Report results
    if [ "$validation_passed" = true ]; then
        log "✓ All required variables are present"
        return 0
    else
        log "✗ Validation FAILED - Missing variables:"
        for var in "${missing_vars[@]}"; do
            log "  - $var"
        done
        return 1
    fi
}

# Function to validate sensitive variables are NOT in a file (for .env.build validation)
# Usage: validate_no_sensitive_vars <path_to_env_file>
# Returns: 0 if no sensitive vars found, 1 if sensitive vars found
validate_no_sensitive_vars() {
    local env_file="$1"
    local sensitive_vars=(
        "DATABASE_USERNAME"
        "DATABASE_PASSWORD"
        "JWT_SECRET"
    )
    local found_sensitive=false
    
    if [ -z "$env_file" ]; then
        log "✗ ERROR: No environment file path provided"
        return 1
    fi
    
    if [ ! -f "$env_file" ]; then
        log "✗ ERROR: Environment file not found: $env_file"
        return 1
    fi
    
    log "Checking for sensitive variables in: $env_file"
    
    for var in "${sensitive_vars[@]}"; do
        if check_variable "$env_file" "$var"; then
            log "  ✗ SECURITY WARNING: $var found in file (should not be present)"
            found_sensitive=true
        else
            log "  ✓ $var not present (correct)"
        fi
    done
    
    if [ "$found_sensitive" = true ]; then
        log "✗ Validation FAILED - Sensitive variables found in build-time config"
        return 1
    else
        log "✓ No sensitive variables found in build-time config"
        return 0
    fi
}

# If script is run directly (not sourced), run validation on provided file
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    if [ -z "$1" ]; then
        echo "Usage: $0 <path_to_env_file>"
        echo "  Validates that the environment file contains all required variables"
        exit 1
    fi
    
    validate_env_file "$1"
    exit $?
fi
