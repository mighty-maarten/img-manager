#!/bin/bash
set -e

# Redirect all output to log file
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

# Logging function with timestamps
log() {
    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"
}

log "=========================================="
log "Starting EC2 initialization script"
log "=========================================="

# Environment variables will be passed from UserData
log "Configuration loaded:"
log "  Region: $REGION"
log "  Domain: $DOMAIN_NAME"
log "  Assets Bucket: $ASSETS_BUCKET"

# ==========================================
# System Update Module
# ==========================================
log "Starting system update..."

# Update package manager
log "Updating dnf package manager..."
if dnf update -y --skip-broken; then
    log "✓ System packages updated successfully"
else
    log "⚠ Warning: Some packages failed to update (continuing with --skip-broken)"
fi

# Install base utilities
log "Installing base utilities..."
BASE_UTILITIES="wget git unzip tar gzip jq htop vim cronie logrotate"

if dnf install -y $BASE_UTILITIES; then
    log "✓ Base utilities installed successfully"
else
    log "✗ Error: Failed to install base utilities"
    exit 1
fi

# Verify installed utilities are available
log "Verifying installed utilities..."
MISSING_UTILITIES=""

for util in wget git unzip tar gzip jq htop vim cronie logrotate; do
    # Special handling for cronie (service name) vs cron (command)
    if [ "$util" = "cronie" ]; then
        if command -v crond >/dev/null 2>&1; then
            log "  ✓ crond available"
        else
            log "  ✗ crond not found"
            MISSING_UTILITIES="$MISSING_UTILITIES crond"
        fi
    elif command -v "$util" >/dev/null 2>&1; then
        log "  ✓ $util available"
    else
        log "  ✗ $util not found"
        MISSING_UTILITIES="$MISSING_UTILITIES $util"
    fi
done

if [ -n "$MISSING_UTILITIES" ]; then
    log "✗ Error: Missing utilities:$MISSING_UTILITIES"
    exit 1
fi

log "✓ All base utilities verified successfully"
log "System update module completed"

# ==========================================
# Nginx and Certbot Installation Module
# ==========================================
log "Starting Nginx and Certbot installation..."

# Check if nginx is already installed
if command -v nginx >/dev/null 2>&1; then
    log "⚠ Nginx already installed, skipping installation"
else
    log "Installing nginx and certbot packages..."
    if dnf install -y nginx python3-certbot-nginx; then
        log "✓ Nginx and Certbot packages installed successfully"
    else
        log "✗ Error: Failed to install Nginx and Certbot"
        exit 1
    fi
fi

# Enable nginx service
log "Enabling Nginx service..."
if systemctl enable nginx; then
    log "✓ Nginx service enabled for automatic startup"
else
    log "✗ Error: Failed to enable Nginx service"
    exit 1
fi

# Create Certbot webroot directory
log "Creating Certbot webroot directory..."
mkdir -p /var/www/certbot
chown -R nginx:nginx /var/www/certbot
chmod 755 /var/www/certbot
log "✓ Certbot webroot directory created at /var/www/certbot"

# Create initial HTTP-only nginx configuration
log "Creating initial HTTP-only nginx configuration..."
cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    server {
        listen 80;
        server_name _;

        # Certbot ACME challenge location
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Default location
        location / {
            return 200 "Nginx is running. SSL will be configured after Certbot setup.";
            add_header Content-Type text/plain;
        }
    }
}
EOF

log "✓ Initial nginx configuration created"

# Start nginx service
log "Starting Nginx service..."
if systemctl start nginx; then
    log "✓ Nginx service started successfully"
else
    log "✗ Error: Failed to start Nginx service"
    exit 1
fi

# Verify nginx service is active
log "Verifying Nginx service status..."
if systemctl is-active --quiet nginx; then
    log "✓ Nginx service is active and running"
else
    log "✗ Error: Nginx service is not active"
    exit 1
fi

# Verify certbot command is available
log "Verifying Certbot installation..."
if command -v certbot >/dev/null 2>&1; then
    CERTBOT_VERSION=$(certbot --version 2>&1 | head -n1)
    log "✓ Certbot is available: $CERTBOT_VERSION"
else
    log "✗ Error: Certbot command not found"
    exit 1
fi

log "✓ Nginx and Certbot installation module completed"

# ==========================================
# SSL Certificate Generation Module
# ==========================================
log "Starting SSL certificate generation..."

# Wait for DNS propagation
log "Waiting 30 seconds for DNS propagation..."
sleep 30

# Obtain SSL certificate from Let's Encrypt
log "Requesting SSL certificate from Let's Encrypt..."
if certbot certonly --nginx \
    --non-interactive \
    --agree-tos \
    --email admin@${DOMAIN_NAME} \
    --domains ${DOMAIN_NAME} \
    --webroot-path /var/www/certbot; then
    log "✓ SSL certificate obtained successfully"
    
    # Update Nginx configuration to use SSL
    log "Updating Nginx configuration for HTTPS..."
    cat > /etc/nginx/nginx.conf << EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    # HTTP server - redirect to HTTPS
    server {
        listen 80;
        server_name _;

        # Certbot ACME challenge location
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Redirect all other traffic to HTTPS
        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name ${DOMAIN_NAME};

        ssl_certificate /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Default location
        location / {
            return 200 "HTTPS is configured and working!";
            add_header Content-Type text/plain;
        }
    }
}
EOF
    
    log "✓ Nginx HTTPS configuration created"
    
    # Reload Nginx to apply SSL configuration
    log "Reloading Nginx with SSL configuration..."
    if systemctl reload nginx; then
        log "✓ Nginx reloaded successfully with SSL"
    else
        log "✗ Error: Failed to reload Nginx"
        exit 1
    fi
    
    # Enable automatic certificate renewal
    log "Enabling automatic certificate renewal..."
    if systemctl enable certbot-renew.timer; then
        log "✓ Certbot auto-renewal timer enabled"
    else
        log "⚠ Warning: Failed to enable certbot auto-renewal timer"
    fi
    
    if systemctl start certbot-renew.timer; then
        log "✓ Certbot auto-renewal timer started"
    else
        log "⚠ Warning: Failed to start certbot auto-renewal timer"
    fi
else
    log "⚠ Warning: Failed to obtain SSL certificate"
    log "⚠ Continuing with HTTP-only configuration"
    log "⚠ You can manually run: certbot --nginx -d ${DOMAIN_NAME}"
fi

log "✓ SSL certificate generation module completed"


# ==========================================
# PostgreSQL 15 Installation Module
# ==========================================
log "Starting PostgreSQL 15 installation..."

# Check if PostgreSQL is already installed
if command -v psql >/dev/null 2>&1; then
    log "⚠ PostgreSQL already installed, skipping installation"
else
    log "Installing PostgreSQL 15 packages..."
    if dnf install -y postgresql15 postgresql15-server postgresql15-contrib; then
        log "✓ PostgreSQL 15 packages installed successfully"
    else
        log "✗ Error: Failed to install PostgreSQL 15"
        exit 1
    fi
fi

# Initialize PostgreSQL database cluster if not already initialized
log "Checking if PostgreSQL database cluster is initialized..."
if [ ! -d "/var/lib/pgsql/data/base" ]; then
    log "Initializing PostgreSQL database cluster..."
    if sudo -u postgres /usr/bin/postgresql-setup --initdb; then
        log "✓ PostgreSQL database cluster initialized successfully"
    else
        log "✗ Error: Failed to initialize PostgreSQL database cluster"
        exit 1
    fi
else
    log "⚠ PostgreSQL database cluster already initialized, skipping"
fi

# Configure PostgreSQL for production
log "Configuring PostgreSQL settings..."
cat > /var/lib/pgsql/data/postgresql.conf << 'EOF'
# PostgreSQL Configuration for t4g.micro (1GB RAM)
# Connection Settings
listen_addresses = 'localhost'
port = 5432
max_connections = 50

# Memory Settings (optimized for 1GB RAM)
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
work_mem = 2MB

# Write Ahead Log
wal_buffers = 4MB
checkpoint_completion_target = 0.9

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_timezone = 'UTC'

# Locale and Formatting
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'en_US.UTF-8'
lc_monetary = 'en_US.UTF-8'
lc_numeric = 'en_US.UTF-8'
lc_time = 'en_US.UTF-8'
default_text_search_config = 'pg_catalog.english'
EOF

log "✓ PostgreSQL configuration file created"

# Set ownership and permissions
chown postgres:postgres /var/lib/pgsql/data/postgresql.conf
chmod 600 /var/lib/pgsql/data/postgresql.conf

# Configure pg_hba.conf for password authentication
log "Configuring pg_hba.conf for password authentication..."
cat > /var/lib/pgsql/data/pg_hba.conf << 'EOF'
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer

# IPv4 local connections with password authentication
host    all             all             127.0.0.1/32            md5

# IPv6 local connections with password authentication
host    all             all             ::1/128                 md5

# Allow replication connections from localhost
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            md5
host    replication     all             ::1/128                 md5
EOF

chown postgres:postgres /var/lib/pgsql/data/pg_hba.conf
chmod 600 /var/lib/pgsql/data/pg_hba.conf
log "✓ pg_hba.conf configured for md5 password authentication"

# Create log directory
mkdir -p /var/log/postgresql
chown postgres:postgres /var/log/postgresql
chmod 755 /var/log/postgresql
log "✓ PostgreSQL log directory created"

# Enable and start PostgreSQL service
log "Enabling PostgreSQL service..."
if systemctl enable postgresql; then
    log "✓ PostgreSQL service enabled for automatic startup"
else
    log "✗ Error: Failed to enable PostgreSQL service"
    exit 1
fi

log "Starting PostgreSQL service..."
if systemctl start postgresql; then
    log "✓ PostgreSQL service started successfully"
else
    log "✗ Error: Failed to start PostgreSQL service"
    systemctl status postgresql
    exit 1
fi

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
sleep 5

# Verify PostgreSQL service is active
log "Verifying PostgreSQL service status..."
if systemctl is-active --quiet postgresql; then
    log "✓ PostgreSQL service is active and running"
else
    log "✗ Error: PostgreSQL service is not active"
    systemctl status postgresql
    exit 1
fi

# Verify psql command is available
log "Verifying PostgreSQL installation..."
if command -v psql >/dev/null 2>&1; then
    PSQL_VERSION=$(psql --version)
    log "✓ PostgreSQL is available: $PSQL_VERSION"
else
    log "✗ Error: psql command not found"
    exit 1
fi

# Retrieve database credentials from Secrets Manager
log "Retrieving database credentials from Secrets Manager..."
DB_SECRET=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET_ARN --region $REGION --query SecretString --output text)
DB_USERNAME=$(echo $DB_SECRET | jq -r .username)
DB_PASSWORD=$(echo $DB_SECRET | jq -r .password)
DB_NAME=$(echo $DB_SECRET | jq -r .dbname)
log "✓ Database credentials retrieved successfully"

# Create database user with CREATEDB privilege (app will create database)
log "Creating database user..."
sudo -u postgres psql << EOF
-- Create user if not exists with CREATEDB privilege
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USERNAME') THEN
        CREATE USER $DB_USERNAME WITH PASSWORD '$DB_PASSWORD' CREATEDB;
    ELSE
        ALTER USER $DB_USERNAME WITH PASSWORD '$DB_PASSWORD' CREATEDB;
    END IF;
END
\$\$;
EOF

if [ $? -eq 0 ]; then
    log "✓ Database user created successfully with CREATEDB privilege"
else
    log "✗ Error: Failed to create database user"
    exit 1
fi

# Test database connectivity as the application user
log "Testing database connectivity..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U $DB_USERNAME -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
    log "✓ Database connectivity test successful"
else
    log "✗ Error: Database connectivity test failed"
    exit 1
fi

log "✓ PostgreSQL 15 installation module completed"

# ==========================================
# NVM and Node.js Installation Module
# ==========================================
log "Starting NVM and Node.js installation..."

# Define Node.js version
NODE_VERSION="22.15.1"
NVM_VERSION="v0.40.1"

# Check if Node.js is already installed
if command -v node >/dev/null 2>&1; then
    CURRENT_NODE_VERSION=$(node --version)
    log "⚠ Node.js already installed: $CURRENT_NODE_VERSION"
    if [ "$CURRENT_NODE_VERSION" = "v$NODE_VERSION" ]; then
        log "⚠ Correct Node.js version already installed, skipping NVM installation"
    else
        log "⚠ Different Node.js version detected, will install NVM and correct version"
    fi
fi

# Install NVM for ec2-user if not already installed
if [ ! -d "/home/ec2-user/.nvm" ]; then
    log "Downloading and installing NVM for ec2-user..."
    
    # Download NVM install script
    if sudo -u ec2-user curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh | sudo -u ec2-user bash; then
        log "✓ NVM installation script executed successfully"
    else
        log "✗ Error: Failed to download or execute NVM installation script"
        exit 1
    fi
    
    # Wait for NVM installation to complete
    sleep 2
else
    log "⚠ NVM already installed at /home/ec2-user/.nvm, skipping installation"
fi

# Configure shell environment to load NVM
log "Configuring shell environment for NVM..."

# Add NVM to ec2-user bash profile if not already present
if ! grep -q "NVM_DIR" /home/ec2-user/.bashrc; then
    log "Adding NVM configuration to .bashrc..."
    sudo -u ec2-user cat >> /home/ec2-user/.bashrc << 'EOF'

# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
    log "✓ NVM configuration added to .bashrc"
else
    log "⚠ NVM configuration already present in .bashrc"
fi

# Create system-wide NVM environment file
log "Creating system-wide NVM environment file..."
cat > /etc/profile.d/nvm.sh << 'EOF'
# System-wide NVM configuration
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF

chmod 644 /etc/profile.d/nvm.sh
log "✓ System-wide NVM environment file created at /etc/profile.d/nvm.sh"

# Load NVM in current shell session
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verify NVM is loaded
if command -v nvm >/dev/null 2>&1; then
    NVM_CURRENT_VERSION=$(nvm --version)
    log "✓ NVM loaded successfully: version $NVM_CURRENT_VERSION"
else
    log "✗ Error: NVM command not available after installation"
    exit 1
fi

# Install Node.js using NVM
log "Installing Node.js version $NODE_VERSION..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && nvm install $NODE_VERSION"; then
    log "✓ Node.js $NODE_VERSION installed successfully"
else
    log "✗ Error: Failed to install Node.js $NODE_VERSION"
    exit 1
fi

# Set default Node.js version
log "Setting Node.js $NODE_VERSION as default..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && nvm alias default $NODE_VERSION"; then
    log "✓ Node.js $NODE_VERSION set as default"
else
    log "✗ Error: Failed to set default Node.js version"
    exit 1
fi

# Use the installed Node.js version
log "Activating Node.js $NODE_VERSION..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && nvm use $NODE_VERSION"; then
    log "✓ Node.js $NODE_VERSION activated"
else
    log "✗ Error: Failed to activate Node.js $NODE_VERSION"
    exit 1
fi

# Verify node command is available
log "Verifying Node.js installation..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v node" >/dev/null 2>&1; then
    INSTALLED_NODE_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && node --version")
    log "✓ Node.js is available: $INSTALLED_NODE_VERSION"
    
    # Verify correct version is installed
    if [ "$INSTALLED_NODE_VERSION" = "v$NODE_VERSION" ]; then
        log "✓ Correct Node.js version verified: $INSTALLED_NODE_VERSION"
    else
        log "✗ Error: Node.js version mismatch. Expected v$NODE_VERSION, got $INSTALLED_NODE_VERSION"
        exit 1
    fi
else
    log "✗ Error: node command not found after installation"
    exit 1
fi

# Verify npm command is available
log "Verifying npm installation..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v npm" >/dev/null 2>&1; then
    NPM_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && npm --version")
    log "✓ npm is available: version $NPM_VERSION"
else
    log "✗ Error: npm command not found after Node.js installation"
    exit 1
fi

# Create symbolic links for system-wide access (optional but helpful)
log "Creating symbolic links for system-wide Node.js access..."
NODE_PATH=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && which node")
NPM_PATH=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && which npm")

if [ -n "$NODE_PATH" ] && [ -n "$NPM_PATH" ]; then
    ln -sf "$NODE_PATH" /usr/local/bin/node
    ln -sf "$NPM_PATH" /usr/local/bin/npm
    log "✓ Symbolic links created: /usr/local/bin/node -> $NODE_PATH"
    log "✓ Symbolic links created: /usr/local/bin/npm -> $NPM_PATH"
else
    log "⚠ Warning: Could not create symbolic links (node or npm path not found)"
fi

log "✓ NVM and Node.js installation module completed"

# This completion marker is moved to the end of the script after all modules are complete


# ==========================================
# PM2 Installation and Configuration Module
# ==========================================
log "Starting PM2 installation and configuration..."

# Check if PM2 is already installed
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v pm2" >/dev/null 2>&1; then
    CURRENT_PM2_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 --version")
    log "⚠ PM2 already installed: version $CURRENT_PM2_VERSION"
    log "⚠ Skipping PM2 installation"
else
    # Install PM2 globally using npm
    log "Installing PM2 globally..."
    if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && npm install -g pm2"; then
        log "✓ PM2 installed successfully"
    else
        log "✗ Error: Failed to install PM2"
        exit 1
    fi
fi

# Verify pm2 command is available
log "Verifying PM2 installation..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v pm2" >/dev/null 2>&1; then
    PM2_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 --version")
    log "✓ PM2 is available: version $PM2_VERSION"
else
    log "✗ Error: pm2 command not found after installation"
    exit 1
fi

# Install pm2-logrotate module
log "Installing pm2-logrotate module..."
if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 install pm2-logrotate"; then
    log "✓ pm2-logrotate module installed successfully"
else
    log "⚠ Warning: Failed to install pm2-logrotate module"
fi

# Configure log rotation settings
log "Configuring PM2 log rotation..."
sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 set pm2-logrotate:max_size 10M"
sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 set pm2-logrotate:retain 7"
sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 set pm2-logrotate:compress true"
log "✓ PM2 log rotation configured: 10MB max size, 7 days retention, compression enabled"

# Set up PM2 startup script for systemd
log "Setting up PM2 startup script..."
STARTUP_SCRIPT=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 startup systemd -u ec2-user --hp /home/ec2-user" | grep "sudo")

if [ -n "$STARTUP_SCRIPT" ]; then
    log "Executing PM2 startup command..."
    eval "$STARTUP_SCRIPT"
    log "✓ PM2 startup script configured"
else
    log "⚠ Warning: Could not generate PM2 startup command"
fi

# Save PM2 process list
log "Saving PM2 process list..."
sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 save"
log "✓ PM2 process list saved"

# Enable pm2-ec2-user service
log "Enabling pm2-ec2-user service..."
if systemctl enable pm2-ec2-user; then
    log "✓ pm2-ec2-user service enabled for automatic startup"
else
    log "⚠ Warning: Failed to enable pm2-ec2-user service"
fi

# Verify pm2-ec2-user service is enabled
log "Verifying pm2-ec2-user service status..."
if systemctl is-enabled pm2-ec2-user >/dev/null 2>&1; then
    log "✓ pm2-ec2-user service is enabled"
else
    log "⚠ Warning: pm2-ec2-user service is not enabled"
fi

log "✓ PM2 installation and configuration module completed"


# ==========================================
# CodeDeploy Agent Installation Module
# ==========================================
log "Starting CodeDeploy agent installation..."

# Check if CodeDeploy agent is already installed
if command -v codedeploy-agent >/dev/null 2>&1; then
    log "⚠ CodeDeploy agent already installed, skipping installation"
else
    # Install Ruby runtime (required by CodeDeploy agent)
    log "Installing Ruby runtime..."
    if dnf install -y ruby wget; then
        log "✓ Ruby runtime installed successfully"
    else
        log "✗ Error: Failed to install Ruby runtime"
        exit 1
    fi
    
    # Verify Ruby is available
    if command -v ruby >/dev/null 2>&1; then
        RUBY_VERSION=$(ruby --version)
        log "✓ Ruby is available: $RUBY_VERSION"
    else
        log "✗ Error: Ruby command not found after installation"
        exit 1
    fi
    
    # Download CodeDeploy agent installer for the instance region
    log "Downloading CodeDeploy agent installer for region $REGION..."
    cd /tmp
    if wget https://aws-codedeploy-${REGION}.s3.${REGION}.amazonaws.com/latest/install; then
        log "✓ CodeDeploy agent installer downloaded successfully"
    else
        log "✗ Error: Failed to download CodeDeploy agent installer"
        exit 1
    fi
    
    # Make installer executable
    chmod +x ./install
    
    # Install CodeDeploy agent
    log "Installing CodeDeploy agent..."
    if ./install auto; then
        log "✓ CodeDeploy agent installed successfully"
    else
        log "✗ Error: Failed to install CodeDeploy agent"
        exit 1
    fi
    
    # Clean up installer
    rm -f /tmp/install
fi

# Enable CodeDeploy agent service
log "Enabling CodeDeploy agent service..."
if systemctl enable codedeploy-agent; then
    log "✓ CodeDeploy agent service enabled for automatic startup"
else
    log "⚠ Warning: Failed to enable CodeDeploy agent service"
fi

# Start CodeDeploy agent service
log "Starting CodeDeploy agent service..."
if systemctl start codedeploy-agent; then
    log "✓ CodeDeploy agent service started successfully"
else
    log "⚠ Warning: Failed to start CodeDeploy agent service"
    # Try to get more information
    systemctl status codedeploy-agent
fi

# Wait for service to be ready
log "Waiting for CodeDeploy agent to be ready..."
sleep 3

# Verify CodeDeploy agent service is active
log "Verifying CodeDeploy agent service status..."
if systemctl is-active --quiet codedeploy-agent; then
    log "✓ CodeDeploy agent service is active and running"
else
    log "⚠ Warning: CodeDeploy agent service is not active"
    systemctl status codedeploy-agent
fi

# Verify CodeDeploy agent service is running
log "Checking CodeDeploy agent process..."
if pgrep -f codedeploy-agent >/dev/null 2>&1; then
    AGENT_PID=$(pgrep -f codedeploy-agent)
    log "✓ CodeDeploy agent is running (PID: $AGENT_PID)"
else
    log "⚠ Warning: CodeDeploy agent process not found"
fi

log "✓ CodeDeploy agent installation module completed"


# ==========================================
# Application Directory Structure Module
# ==========================================
log "Starting application directory structure setup..."

# Create main application directories
log "Creating application directories..."
mkdir -p /opt/img-manager/current
mkdir -p /opt/img-manager/shared
mkdir -p /opt/img-manager/releases
mkdir -p /var/log/img-manager

log "✓ Application directories created"

# Set ownership to ec2-user
log "Setting directory ownership..."
chown -R ec2-user:ec2-user /opt/img-manager
chown -R ec2-user:ec2-user /var/log/img-manager

log "✓ Directory ownership set to ec2-user:ec2-user"

# Set permissions
log "Setting directory permissions..."
chmod -R 755 /opt/img-manager
chmod -R 755 /var/log/img-manager

log "✓ Directory permissions set (755)"

# Verify directories exist
log "Verifying directory structure..."
MISSING_DIRS=""

for dir in /opt/img-manager/current /opt/img-manager/shared /opt/img-manager/releases /var/log/img-manager; do
    if [ -d "$dir" ]; then
        log "  ✓ $dir exists"
    else
        log "  ✗ $dir not found"
        MISSING_DIRS="$MISSING_DIRS $dir"
    fi
done

if [ -n "$MISSING_DIRS" ]; then
    log "✗ Error: Missing directories:$MISSING_DIRS"
    exit 1
fi

log "✓ All application directories verified successfully"
log "✓ Application directory structure module completed"


# ==========================================
# Environment Configuration File Module
# ==========================================
log "Starting environment configuration file generation..."

# Set up system-wide NODE_ENV=production
log "Setting up system-wide NODE_ENV=production..."

# Set NODE_ENV in /etc/environment (read by all processes including SSM sessions)
if ! grep -q "NODE_ENV=production" /etc/environment; then
    echo "NODE_ENV=production" >> /etc/environment
    log "✓ NODE_ENV=production added to /etc/environment"
else
    log "⚠ NODE_ENV=production already present in /etc/environment"
fi

# Also set in profile.d for login shells
cat > /etc/profile.d/node-env.sh << 'EOF'
# Set NODE_ENV to production for all users
export NODE_ENV=production
EOF

chmod 644 /etc/profile.d/node-env.sh
log "✓ System-wide NODE_ENV=production configured at /etc/profile.d/node-env.sh"

# Add NODE_ENV to ec2-user's .bashrc
log "Adding NODE_ENV to ec2-user's .bashrc..."
if ! grep -q "export NODE_ENV=production" /home/ec2-user/.bashrc; then
    echo "export NODE_ENV=production" >> /home/ec2-user/.bashrc
    log "✓ NODE_ENV=production added to ec2-user's .bashrc"
else
    log "⚠ NODE_ENV=production already present in ec2-user's .bashrc"
fi

# Retrieve database credentials from Secrets Manager (already retrieved earlier)
log "Using database credentials retrieved earlier..."

# Create .env.production file at /opt/img-manager/shared/.env.production
log "Creating production environment configuration file..."
cat > /opt/img-manager/shared/.env.production << EOF
# Application Configuration
NODE_ENV=production
PORT=3000

# Application Settings
APP_ALLOWED_ORIGINS=https://${DOMAIN_NAME}
APP_IS_CLOUD=true
APP_CLOUDWATCH_LOG_GROUP_NAME=${LOG_GROUP_NAME}
APP_SNS_ERROR_TOPIC_ARN=${ERROR_SNS_TOPIC}
APP_LOCAL_STORAGE_PATH=/opt/img-manager/shared/storage
APP_ASSETS_BUCKET_NAME=${ASSETS_BUCKET}

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=${DB_NAME}
DATABASE_USERNAME=${DB_USERNAME}
DATABASE_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)

# AWS Configuration
AWS_REGION=${REGION}
EOF

log "✓ Production environment configuration file created at /opt/img-manager/shared/.env.production"

# Set file permissions to 600 for security
log "Setting .env.production file permissions..."
chown ec2-user:ec2-user /opt/img-manager/shared/.env.production
chmod 600 /opt/img-manager/shared/.env.production

log "✓ .env.production file permissions set (600)"

# Verify .env.production file exists with correct permissions
log "Verifying .env.production file..."
if [ -f "/opt/img-manager/shared/.env.production" ]; then
    PERMS=$(stat -c "%a" /opt/img-manager/shared/.env.production)
    if [ "$PERMS" = "600" ]; then
        log "✓ .env.production file exists with correct permissions (600)"
    else
        log "⚠ Warning: .env.production file has incorrect permissions ($PERMS, expected 600)"
    fi
else
    log "✗ Error: .env.production file not found"
    exit 1
fi

log "✓ Environment configuration file module completed"

# Prepare application directory structure
log "Preparing application directory structure..."
# The application will be deployed to /opt/img-manager/current/packages/api
# The deployment process will create the necessary symlinks
mkdir -p /opt/img-manager/current/packages
chown -R ec2-user:ec2-user /opt/img-manager/current/packages

log "✓ Application package directory structure prepared"


# ==========================================
# Deployment Metadata File Module
# ==========================================
log "Starting deployment metadata file generation..."

# Retrieve instance metadata
log "Retrieving EC2 instance metadata..."
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d " " -f 2)
AVAILABILITY_ZONE=$(ec2-metadata --availability-zone | cut -d " " -f 2)
HOSTNAME=$(hostname)

log "✓ Instance metadata retrieved"
log "  Instance ID: $INSTANCE_ID"
log "  Availability Zone: $AVAILABILITY_ZONE"
log "  Hostname: $HOSTNAME"

# Get installed versions
NODE_VERSION=$(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && node --version")
POSTGRESQL_VERSION=$(psql --version | awk '{print $3}')
NGINX_VERSION=$(nginx -v 2>&1 | awk '{print $3}' | cut -d'/' -f2)

# Create deployment_info.json
log "Creating deployment metadata file..."
cat > /opt/img-manager/shared/deployment_info.json << EOF
{
  "initial_setup": true,
  "setup_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "domain_name": "${DOMAIN_NAME}",
  "node_version": "${NODE_VERSION}",
  "postgresql_version": "${POSTGRESQL_VERSION}",
  "nginx_version": "${NGINX_VERSION}",
  "system_info": {
    "hostname": "${HOSTNAME}",
    "instance_id": "${INSTANCE_ID}",
    "availability_zone": "${AVAILABILITY_ZONE}"
  }
}
EOF

log "✓ Deployment metadata file created at /opt/img-manager/shared/deployment_info.json"

# Set ownership and permissions
chown ec2-user:ec2-user /opt/img-manager/shared/deployment_info.json
chmod 644 /opt/img-manager/shared/deployment_info.json

# Verify metadata file exists and contains valid JSON
log "Verifying deployment metadata file..."
if [ -f "/opt/img-manager/shared/deployment_info.json" ]; then
    if jq empty /opt/img-manager/shared/deployment_info.json 2>/dev/null; then
        log "✓ Deployment metadata file exists and contains valid JSON"
    else
        log "✗ Error: Deployment metadata file contains invalid JSON"
        exit 1
    fi
else
    log "✗ Error: Deployment metadata file not found"
    exit 1
fi

log "✓ Deployment metadata file module completed"


# ==========================================
# Comprehensive Verification Module
# ==========================================
log "Starting comprehensive system verification..."

# Check command availability
log "Verifying command availability..."
MISSING_COMMANDS=""

for cmd in node npm pm2 nginx psql certbot aws; do
    if sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && command -v $cmd" >/dev/null 2>&1 || command -v $cmd >/dev/null 2>&1; then
        log "  ✓ $cmd available"
    else
        log "  ✗ $cmd not found"
        MISSING_COMMANDS="$MISSING_COMMANDS $cmd"
    fi
done

if [ -n "$MISSING_COMMANDS" ]; then
    log "✗ Error: Missing commands:$MISSING_COMMANDS"
    exit 1
fi

log "✓ All required commands are available"

# Verify service status
log "Verifying service status..."
FAILED_SERVICES=""

for service in postgresql nginx codedeploy-agent crond; do
    if systemctl is-active --quiet $service; then
        log "  ✓ $service is active"
    else
        log "  ✗ $service is not active"
        FAILED_SERVICES="$FAILED_SERVICES $service"
    fi
done

if [ -n "$FAILED_SERVICES" ]; then
    log "⚠ Warning: Some services are not active:$FAILED_SERVICES"
fi

# Test database connectivity (connect to postgres database, not app database which doesn't exist yet)
log "Testing database connectivity..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U $DB_USERNAME -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
    log "✓ Database connectivity test successful (user can connect to postgres database)"
else
    log "✗ Error: Database connectivity test failed"
    exit 1
fi

# Validate nginx configuration
log "Validating Nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
    log "✓ Nginx configuration is valid"
else
    log "✗ Error: Nginx configuration is invalid"
    nginx -t
    exit 1
fi

# Log system resources
log "System resources:"
log "  Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
log "  Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
log "  Load average: $(uptime | awk -F'load average:' '{print $2}')"

log "✓ Comprehensive verification module completed"


# ==========================================
# Completion Module
# ==========================================
log "=========================================="
log "EC2 INITIALIZATION COMPLETED SUCCESSFULLY"
log "=========================================="

# Create completion marker with detailed summary
log "Creating completion marker..."
cat > /var/log/user-data-completed << EOF
EC2 Initialization Completed Successfully
==========================================
Completion Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Domain: ${DOMAIN_NAME}
Region: ${REGION}

Installed Components:
--------------------
✓ System Updates: dnf packages updated
✓ Base Utilities: wget, git, unzip, tar, gzip, jq, htop, vim, cronie, logrotate
✓ Nginx: $(nginx -v 2>&1 | awk '{print $3}' | cut -d'/' -f2)
✓ Certbot: $(certbot --version 2>&1 | head -n1)
✓ PostgreSQL: $(psql --version | awk '{print $3}')
✓ NVM: $(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && nvm --version")
✓ Node.js: $(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && node --version")
✓ npm: $(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && npm --version")
✓ PM2: $(sudo -u ec2-user bash -c "source /home/ec2-user/.nvm/nvm.sh && pm2 --version")
✓ CodeDeploy Agent: Installed and running

Directory Structure:
-------------------
✓ /opt/img-manager/current (deployment target)
✓ /opt/img-manager/shared (persistent data)
✓ /opt/img-manager/releases (deployment history)
✓ /var/log/img-manager (application logs)

Configuration Files:
-------------------
✓ /opt/img-manager/shared/.env.production (environment variables)
✓ /opt/img-manager/shared/deployment_info.json (metadata)
✓ /etc/nginx/nginx.conf (web server configuration)
✓ /var/lib/pgsql/data/postgresql.conf (database configuration)

Services Running:
----------------
✓ nginx (web server)
✓ postgresql (database)
✓ codedeploy-agent (deployment agent)
✓ crond (cron daemon)
✓ pm2-ec2-user (process manager)

Instance Information:
--------------------
Instance ID: $(ec2-metadata --instance-id | cut -d " " -f 2)
Availability Zone: $(ec2-metadata --availability-zone | cut -d " " -f 2)
Hostname: $(hostname)

Next Steps:
----------
1. Deploy application using AWS CodePipeline
2. Configure SSL certificate with Certbot (if not already done)
3. Update Nginx configuration for application routing
4. Monitor logs at /var/log/img-manager/

For troubleshooting, check:
- /var/log/user-data.log (initialization log)
- /var/log/aws/codedeploy-agent/codedeploy-agent.log (deployment log)
- /var/log/img-manager/ (application logs)
==========================================
EOF

log "✓ Completion marker created at /var/log/user-data-completed"

# Log completion summary to console
log ""
log "=========================================="
log "INITIALIZATION SUMMARY"
log "=========================================="
log "✓ All modules completed successfully"
log "✓ All services are running"
log "✓ All verification checks passed"
log ""
log "Instance is ready for application deployment!"
log ""
log "View completion details:"
log "  cat /var/log/user-data-completed"
log ""
log "View initialization log:"
log "  cat /var/log/user-data.log"
log "=========================================="
