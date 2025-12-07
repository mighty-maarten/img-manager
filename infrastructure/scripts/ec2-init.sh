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

# Create database and user
log "Creating database and user..."
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USERNAME') THEN
        CREATE USER $DB_USERNAME WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USERNAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USERNAME;
EOF

if [ $? -eq 0 ]; then
    log "✓ Database and user created successfully"
else
    log "✗ Error: Failed to create database and user"
    exit 1
fi

# Test database connectivity
log "Testing database connectivity..."
if sudo -u postgres psql -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
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

# ==========================================
# Completion
# ==========================================
log "=========================================="
log "EC2 initialization completed successfully"
log "=========================================="

# Create completion marker
echo "EC2 initialization completed at $(date)" > /var/log/user-data-completed
