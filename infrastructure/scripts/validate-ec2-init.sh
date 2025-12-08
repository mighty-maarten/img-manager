#!/bin/bash
# Validation script for EC2 initialization
# Run this on the EC2 instance to verify all components are installed correctly

set -e

echo "=========================================="
echo "EC2 Initialization Validation Script"
echo "=========================================="
echo ""

FAILED_CHECKS=0
PASSED_CHECKS=0

check_command() {
    local cmd=$1
    local name=$2
    
    if command -v "$cmd" >/dev/null 2>&1; then
        echo "✓ $name is installed"
        ((PASSED_CHECKS++))
        return 0
    else
        echo "✗ $name is NOT installed"
        ((FAILED_CHECKS++))
        return 1
    fi
}

check_service() {
    local service=$1
    local name=$2
    
    if systemctl is-active --quiet "$service"; then
        echo "✓ $name service is running"
        ((PASSED_CHECKS++))
        return 0
    else
        echo "✗ $name service is NOT running"
        ((FAILED_CHECKS++))
        return 1
    fi
}

check_directory() {
    local dir=$1
    local name=$2
    
    if [ -d "$dir" ]; then
        echo "✓ $name directory exists"
        ((PASSED_CHECKS++))
        return 0
    else
        echo "✗ $name directory does NOT exist"
        ((FAILED_CHECKS++))
        return 1
    fi
}

check_file() {
    local file=$1
    local name=$2
    
    if [ -f "$file" ]; then
        echo "✓ $name file exists"
        ((PASSED_CHECKS++))
        return 0
    else
        echo "✗ $name file does NOT exist"
        ((FAILED_CHECKS++))
        return 1
    fi
}

echo "1. Checking Base Utilities..."
echo "------------------------------"
check_command wget "wget"
check_command git "git"
check_command unzip "unzip"
check_command jq "jq"
check_command htop "htop"
check_command vim "vim"
echo ""

echo "2. Checking Web Server..."
echo "------------------------------"
check_command nginx "Nginx"
check_command certbot "Certbot"
check_service nginx "Nginx"
echo ""

echo "3. Checking Database..."
echo "------------------------------"
check_command psql "PostgreSQL"
check_service postgresql "PostgreSQL"
if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✓ PostgreSQL database connectivity"
    ((PASSED_CHECKS++))
else
    echo "✗ PostgreSQL database connectivity FAILED"
    ((FAILED_CHECKS++))
fi
echo ""

echo "4. Checking Node.js Environment..."
echo "------------------------------"
if [ -d "/home/ec2-user/.nvm" ]; then
    echo "✓ NVM is installed"
    ((PASSED_CHECKS++))
    
    # Check Node.js via ec2-user
    if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v node" >/dev/null 2>&1; then
        NODE_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && node --version")
        echo "✓ Node.js is installed: $NODE_VERSION"
        ((PASSED_CHECKS++))
    else
        echo "✗ Node.js is NOT installed"
        ((FAILED_CHECKS++))
    fi
    
    if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v npm" >/dev/null 2>&1; then
        NPM_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && npm --version")
        echo "✓ npm is installed: $NPM_VERSION"
        ((PASSED_CHECKS++))
    else
        echo "✗ npm is NOT installed"
        ((FAILED_CHECKS++))
    fi
else
    echo "✗ NVM is NOT installed"
    ((FAILED_CHECKS++))
fi
echo ""

echo "5. Checking Process Manager..."
echo "------------------------------"
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v pm2" >/dev/null 2>&1; then
    PM2_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 --version")
    echo "✓ PM2 is installed: $PM2_VERSION"
    ((PASSED_CHECKS++))
else
    echo "✗ PM2 is NOT installed"
    ((FAILED_CHECKS++))
fi
check_service pm2-ec2-user "PM2"
echo ""

echo "6. Checking CodeDeploy Agent..."
echo "------------------------------"
check_command codedeploy-agent "CodeDeploy Agent"
check_service codedeploy-agent "CodeDeploy Agent"
echo ""

echo "7. Checking Application Directories..."
echo "------------------------------"
check_directory "/opt/img-manager" "Application root"
check_directory "/opt/img-manager/current" "Current deployment"
check_directory "/opt/img-manager/shared" "Shared data"
check_directory "/opt/img-manager/releases" "Releases"
check_directory "/var/log/img-manager" "Application logs"
echo ""

echo "8. Checking Configuration Files..."
echo "------------------------------"
check_file "/opt/img-manager/shared/.env" "Environment configuration"
check_file "/opt/img-manager/shared/deployment_info.json" "Deployment metadata"
check_file "/var/log/user-data-completed" "Initialization completion marker"
echo ""

echo "9. Checking File Permissions..."
echo "------------------------------"
if [ -f "/opt/img-manager/shared/.env" ]; then
    PERMS=$(stat -c "%a" /opt/img-manager/shared/.env)
    if [ "$PERMS" = "600" ]; then
        echo "✓ .env file has correct permissions (600)"
        ((PASSED_CHECKS++))
    else
        echo "✗ .env file has incorrect permissions ($PERMS, expected 600)"
        ((FAILED_CHECKS++))
    fi
fi

OWNER=$(stat -c "%U:%G" /opt/img-manager)
if [ "$OWNER" = "ec2-user:ec2-user" ]; then
    echo "✓ Application directory has correct ownership (ec2-user:ec2-user)"
    ((PASSED_CHECKS++))
else
    echo "✗ Application directory has incorrect ownership ($OWNER)"
    ((FAILED_CHECKS++))
fi
echo ""

echo "10. Checking System Resources..."
echo "------------------------------"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo "Load average: $(uptime | awk -F'load average:' '{print $2}')"
echo ""

echo "=========================================="
echo "VALIDATION SUMMARY"
echo "=========================================="
echo "Passed checks: $PASSED_CHECKS"
echo "Failed checks: $FAILED_CHECKS"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo "✓ ALL CHECKS PASSED - EC2 initialization is complete and valid!"
    echo ""
    exit 0
else
    echo "✗ SOME CHECKS FAILED - Please review the output above"
    echo ""
    exit 1
fi
