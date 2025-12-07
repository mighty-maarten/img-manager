import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, StackProps, Tags } from 'aws-cdk-lib';
import {
    AmazonLinuxCpuType,
    CfnEIP,
    CfnEIPAssociation,
    EbsDeviceVolumeType,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    Peer,
    Port,
    SecurityGroup,
    SubnetType,
    UserData,
    Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {
    Effect,
    ManagedPolicy,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { identifyResource } from './config-util';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { AccessDefinition } from './access-definition';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

interface Ec2StackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly vpc: Vpc;
    readonly assetsBucket: Bucket;
    readonly deploymentArtifactsBucket?: Bucket;
    readonly cloudwatchLogs: LogGroup;
    readonly sshAccessDefinitions: AccessDefinition[];
    readonly domainName: string;
    readonly hostedZoneName: string;
    readonly secretsWildcardArn: string;
    readonly errorSNSTopicARN: string;
    readonly taskEnv: { [key: string]: string };
}

export class Ec2Stack extends cdk.Stack {
    readonly instance: Instance;
    readonly elasticIp: CfnEIP;
    readonly databaseSecret: Secret;

    constructor(scope: Construct, id: string, props: Ec2StackProps) {
        super(scope, id, props);

        const resourcePrefix = props.resourcePrefix;

        // Create database secret
        this.databaseSecret = new Secret(this, identifyResource(resourcePrefix, 'db-secret'), {
            secretName: identifyResource(resourcePrefix, 'ec2-database-credentials'),
            description: 'Database credentials for EC2 PostgreSQL instance',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    username: 'img_manager_user',
                    dbname: 'img_manager',
                    host: 'localhost',
                    port: 5432,
                }),
                generateStringKey: 'password',
                excludeCharacters: '"@/\\\'',
                passwordLength: 32,
            },
        });

        // Security Groups
        const httpsSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'ec2-https-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'ec2-https-sg'),
                vpc: props.vpc,
                description: 'Allow HTTPS traffic',
                allowAllOutbound: true,
            },
        );
        httpsSecurityGroup.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(443),
            'Allow HTTPS from anywhere',
        );

        const httpSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'ec2-http-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'ec2-http-sg'),
                vpc: props.vpc,
                description: 'Allow HTTP traffic for Certbot',
                allowAllOutbound: true,
            },
        );
        httpSecurityGroup.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(80),
            'Allow HTTP from anywhere',
        );

        const sshSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'ec2-ssh-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'ec2-ssh-sg'),
                vpc: props.vpc,
                description: 'Allow SSH from specific IPs',
                allowAllOutbound: true,
            },
        );

        // Add SSH access rules from access definitions
        props.sshAccessDefinitions.forEach((accessDef) => {
            sshSecurityGroup.addIngressRule(
                Peer.ipv4(accessDef.ipAddress),
                Port.tcp(22),
                `SSH access from ${accessDef.description}`,
            );
        });

        // IAM Role for EC2
        const ec2Role = new Role(this, identifyResource(resourcePrefix, 'ec2-role'), {
            roleName: identifyResource(resourcePrefix, 'ec2-role'),
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
            description: 'IAM role for EC2 instance with native deployment permissions',
        });

        // S3 permissions for deployment artifacts bucket
        if (props.deploymentArtifactsBucket) {
            props.deploymentArtifactsBucket.grantRead(ec2Role);
        } else {
            // Fallback permissions if bucket not provided
            ec2Role.addToPolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['s3:GetObject', 's3:ListBucket'],
                    resources: [
                        `arn:aws:s3:::${resourcePrefix}-deployment-artifacts`,
                        `arn:aws:s3:::${resourcePrefix}-deployment-artifacts/*`,
                    ],
                }),
            );
        }

        // S3 permissions for CodePipeline artifacts (auto-generated buckets)
        // CodePipeline creates buckets with various naming patterns, so we need broader permissions
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject', 's3:ListBucket'],
                resources: [
                    // Deployment artifacts bucket (created by DeploymentStack)
                    `arn:aws:s3:::${resourcePrefix}-deployment-artifacts`,
                    `arn:aws:s3:::${resourcePrefix}-deployment-artifacts/*`,
                    // CodePipeline auto-generated buckets (various patterns)
                    `arn:aws:s3:::${resourcePrefix}-depl-*`,
                    `arn:aws:s3:::${resourcePrefix}-depl-*/*`,
                    `arn:aws:s3:::codepipeline-${this.region}-*`,
                    `arn:aws:s3:::codepipeline-${this.region}-*/*`,
                    // Additional patterns for CodePipeline artifact buckets
                    `arn:aws:s3:::*-${resourcePrefix.toLowerCase()}-*`,
                    `arn:aws:s3:::*-${resourcePrefix.toLowerCase()}-*/*`,
                    `arn:aws:s3:::*imgmanager*`,
                    `arn:aws:s3:::*imgmanager*/*`,
                ],
            }),
        );

        // S3 permissions for assets bucket (read/write)
        props.assetsBucket.grantReadWrite(ec2Role);

        // S3 permissions for database migration bucket (if needed)
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
                resources: [
                    `arn:aws:s3:::${resourcePrefix}-db-backups`,
                    `arn:aws:s3:::${resourcePrefix}-db-backups/*`,
                ],
            }),
        );

        // CodeDeploy permissions for agent
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'codedeploy:CreateDeployment',
                    'codedeploy:GetApplication',
                    'codedeploy:GetApplicationRevision',
                    'codedeploy:GetDeployment',
                    'codedeploy:GetDeploymentConfig',
                    'codedeploy:RegisterApplicationRevision',
                ],
                resources: ['*'],
            }),
        );

        // Secrets Manager read permissions
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
                resources: [props.secretsWildcardArn, this.databaseSecret.secretArn],
            }),
        );

        // CloudWatch Logs write permissions
        props.cloudwatchLogs.grantWrite(ec2Role);
        
        // Additional CloudWatch Logs permissions needed by the application
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'logs:DescribeLogStreams',
                    'logs:DescribeLogGroups',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents',
                ],
                resources: [
                    props.cloudwatchLogs.logGroupArn,
                    `${props.cloudwatchLogs.logGroupArn}:*`,
                ],
            }),
        );

        // SNS publish permissions
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['sns:Publish'],
                resources: [props.errorSNSTopicARN],
            }),
        );

        // SSM permissions for Systems Manager
        ec2Role.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        );

        // Additional SSM permissions for deployment
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ssm:UpdateInstanceInformation',
                    'ssm:SendCommand',
                    'ssm:ListCommandInvocations',
                    'ssm:DescribeInstanceInformation',
                    'ssm:GetCommandInvocation',
                ],
                resources: ['*'],
            }),
        );

        // AMI creation permissions for backups
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ec2:CreateImage',
                    'ec2:CreateSnapshot',
                    'ec2:CreateTags',
                    'ec2:DescribeImages',
                    'ec2:DescribeInstances',
                    'ec2:DescribeSnapshots',
                    'ec2:DeregisterImage',
                    'ec2:DeleteSnapshot',
                ],
                resources: ['*'],
            }),
        );

        // User Data Script for Native Deployment
        const userData = UserData.forLinux();
        
        // Create environment variables string for the application
        const envVars = Object.entries(props.taskEnv)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // ============================================
        // USERDATA SCRIPT VERSION CONTROL
        // ============================================
        // Change this version number ONLY when you want to replace the EC2 instance
        // This allows you to modify the script below without triggering instance replacement
        const USERDATA_VERSION = 'v1.0.0';
        
        // Initialize UserData script with logging setup
        // NOTE: To comment out sections during development, wrap them in /* */ block comments
        // or use conditional logic in the bash script itself
        userData.addCommands(
            `# UserData Version: ${USERDATA_VERSION}`,
            '#!/bin/bash',
            'set -e',
            '',
            '# Redirect all output to log file',
            'exec > >(tee -a /var/log/user-data.log)',
            'exec 2>&1',
            '',
            '# Logging function with timestamps',
            'log() {',
            '    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"',
            '}',
            '',
            'log "=========================================="',
            'log "Starting EC2 initialization script"',
            'log "=========================================="',
            '',
            '# Environment variables',
            `REGION="${this.region}"`,
            `DOMAIN_NAME="${props.domainName}"`,
            `DB_SECRET_ARN="${this.databaseSecret.secretArn}"`,
            `ASSETS_BUCKET="${props.assetsBucket.bucketName}"`,
            `ERROR_SNS_TOPIC="${props.errorSNSTopicARN}"`,
            `LOG_GROUP_NAME="${props.cloudwatchLogs.logGroupName}"`,
            '',
            'log "Configuration loaded:"',
            'log "  Region: $REGION"',
            'log "  Domain: $DOMAIN_NAME"',
            'log "  Assets Bucket: $ASSETS_BUCKET"',
            '',
            '# ==========================================',
            '# System Update Module',
            '# ==========================================',
            'log "Starting system update..."',
            '',
            '# Update package manager',
            'log "Updating dnf package manager..."',
            'if dnf update -y --skip-broken; then',
            '    log "✓ System packages updated successfully"',
            'else',
            '    log "⚠ Warning: Some packages failed to update (continuing with --skip-broken)"',
            'fi',
            '',
            '# Install base utilities',
            'log "Installing base utilities..."',
            'BASE_UTILITIES="wget git unzip tar gzip jq htop vim cronie logrotate"',
            '',
            'if dnf install -y $BASE_UTILITIES; then',
            '    log "✓ Base utilities installed successfully"',
            'else',
            '    log "✗ Error: Failed to install base utilities"',
            '    exit 1',
            'fi',
            '',
            '# Verify installed utilities are available',
            'log "Verifying installed utilities..."',
            'MISSING_UTILITIES=""',
            '',
            'for util in wget git unzip tar gzip jq htop vim cronie logrotate; do',
            '    # Special handling for cronie (service name) vs cron (command)',
            '    if [ "$util" = "cronie" ]; then',
            '        if command -v crond >/dev/null 2>&1; then',
            '            log "  ✓ crond available"',
            '        else',
            '            log "  ✗ crond not found"',
            '            MISSING_UTILITIES="$MISSING_UTILITIES crond"',
            '        fi',
            '    elif command -v "$util" >/dev/null 2>&1; then',
            '        log "  ✓ $util available"',
            '    else',
            '        log "  ✗ $util not found"',
            '        MISSING_UTILITIES="$MISSING_UTILITIES $util"',
            '    fi',
            'done',
            '',
            'if [ -n "$MISSING_UTILITIES" ]; then',
            '    log "✗ Error: Missing utilities:$MISSING_UTILITIES"',
            '    exit 1',
            'fi',
            '',
            'log "✓ All base utilities verified successfully"',
            'log "System update module completed"',
            '',
            '# ==========================================',
            '# Nginx and Certbot Installation Module',
            '# ==========================================',
            'log "Starting Nginx and Certbot installation..."',
            '',
            '# Check if nginx is already installed',
            'if command -v nginx >/dev/null 2>&1; then',
            '    log "⚠ Nginx already installed, skipping installation"',
            'else',
            '    log "Installing nginx and certbot packages..."',
            '    if dnf install -y nginx python3-certbot-nginx; then',
            '        log "✓ Nginx and Certbot packages installed successfully"',
            '    else',
            '        log "✗ Error: Failed to install Nginx and Certbot"',
            '        exit 1',
            '    fi',
            'fi',
            '',
            '# Enable nginx service',
            'log "Enabling Nginx service..."',
            'if systemctl enable nginx; then',
            '    log "✓ Nginx service enabled for automatic startup"',
            'else',
            '    log "✗ Error: Failed to enable Nginx service"',
            '    exit 1',
            'fi',
            '',
            '# Create Certbot webroot directory',
            'log "Creating Certbot webroot directory..."',
            'mkdir -p /var/www/certbot',
            'chown -R nginx:nginx /var/www/certbot',
            'chmod 755 /var/www/certbot',
            'log "✓ Certbot webroot directory created at /var/www/certbot"',
            '',
            '# Create initial HTTP-only nginx configuration',
            'log "Creating initial HTTP-only nginx configuration..."',
            'cat > /etc/nginx/nginx.conf << \'EOF\'',
            'user nginx;',
            'worker_processes auto;',
            'error_log /var/log/nginx/error.log notice;',
            'pid /run/nginx.pid;',
            '',
            'events {',
            '    worker_connections 1024;',
            '}',
            '',
            'http {',
            '    log_format main \'$remote_addr - $remote_user [$time_local] "$request" \'',
            '                    \'$status $body_bytes_sent "$http_referer" \'',
            '                    \'"$http_user_agent" "$http_x_forwarded_for"\';',
            '',
            '    access_log /var/log/nginx/access.log main;',
            '',
            '    sendfile            on;',
            '    tcp_nopush          on;',
            '    keepalive_timeout   65;',
            '    types_hash_max_size 4096;',
            '',
            '    include             /etc/nginx/mime.types;',
            '    default_type        application/octet-stream;',
            '',
            '    server {',
            '        listen 80;',
            '        server_name _;',
            '',
            '        # Certbot ACME challenge location',
            '        location /.well-known/acme-challenge/ {',
            '            root /var/www/certbot;',
            '        }',
            '',
            '        # Default location',
            '        location / {',
            '            return 200 \"Nginx is running. SSL will be configured after Certbot setup.\";',
            '            add_header Content-Type text/plain;',
            '        }',
            '    }',
            '}',
            'EOF',
            '',
            'log "✓ Initial nginx configuration created"',
            '',
            '# Start nginx service',
            'log "Starting Nginx service..."',
            'if systemctl start nginx; then',
            '    log "✓ Nginx service started successfully"',
            'else',
            '    log "✗ Error: Failed to start Nginx service"',
            '    exit 1',
            'fi',
            '',
            '# Verify nginx service is active',
            'log "Verifying Nginx service status..."',
            'if systemctl is-active --quiet nginx; then',
            '    log "✓ Nginx service is active and running"',
            'else',
            '    log "✗ Error: Nginx service is not active"',
            '    exit 1',
            'fi',
            '',
            '# Verify certbot command is available',
            'log "Verifying Certbot installation..."',
            'if command -v certbot >/dev/null 2>&1; then',
            '    CERTBOT_VERSION=$(certbot --version 2>&1 | head -n1)',
            '    log "✓ Certbot is available: $CERTBOT_VERSION"',
            'else',
            '    log "✗ Error: Certbot command not found"',
            '    exit 1',
            'fi',
            '',
            'log "✓ Nginx and Certbot installation module completed"',
            ''
        );

        // ============================================
        // SSL Certificate Generation Module
        // ============================================
        userData.addCommands(
            '# ==========================================',
            '# SSL Certificate Generation Module',
            '# ==========================================',
            'log "Starting SSL certificate generation..."',
            '',
            '# Wait for DNS propagation',
            'log "Waiting 30 seconds for DNS propagation..."',
            'sleep 30',
            '',
            '# Obtain SSL certificate from Let\'s Encrypt',
            'log "Requesting SSL certificate from Let\'s Encrypt..."',
            'if certbot certonly --nginx \\',
            '    --non-interactive \\',
            '    --agree-tos \\',
            '    --email admin@${DOMAIN_NAME} \\',
            '    --domains ${DOMAIN_NAME} \\',
            '    --webroot-path /var/www/certbot; then',
            '    log "✓ SSL certificate obtained successfully"',
            '    ',
            '    # Update Nginx configuration to use SSL',
            '    log "Updating Nginx configuration for HTTPS..."',
            '    cat > /etc/nginx/nginx.conf << \'EOF\'',
            'user nginx;',
            'worker_processes auto;',
            'error_log /var/log/nginx/error.log notice;',
            'pid /run/nginx.pid;',
            '',
            'events {',
            '    worker_connections 1024;',
            '}',
            '',
            'http {',
            '    log_format main \'$remote_addr - $remote_user [$time_local] "$request" \'',
            '                    \'$status $body_bytes_sent "$http_referer" \'',
            '                    \'"$http_user_agent" "$http_x_forwarded_for"\';',
            '',
            '    access_log /var/log/nginx/access.log main;',
            '',
            '    sendfile            on;',
            '    tcp_nopush          on;',
            '    keepalive_timeout   65;',
            '    types_hash_max_size 4096;',
            '',
            '    include             /etc/nginx/mime.types;',
            '    default_type        application/octet-stream;',
            '',
            '    # HTTP server - redirect to HTTPS',
            '    server {',
            '        listen 80;',
            '        server_name _;',
            '',
            '        # Certbot ACME challenge location',
            '        location /.well-known/acme-challenge/ {',
            '            root /var/www/certbot;',
            '        }',
            '',
            '        # Redirect all other traffic to HTTPS',
            '        location / {',
            '            return 301 https://$host$request_uri;',
            '        }',
            '    }',
            '',
            '    # HTTPS server',
            '    server {',
            '        listen 443 ssl http2;',
            `        server_name ${props.domainName};`,
            '',
            `        ssl_certificate /etc/letsencrypt/live/${props.domainName}/fullchain.pem;`,
            `        ssl_certificate_key /etc/letsencrypt/live/${props.domainName}/privkey.pem;`,
            '',
            '        # SSL configuration',
            '        ssl_protocols TLSv1.2 TLSv1.3;',
            '        ssl_ciphers HIGH:!aNULL:!MD5;',
            '        ssl_prefer_server_ciphers on;',
            '',
            '        # Default location',
            '        location / {',
            '            return 200 \"HTTPS is configured and working!\";',
            '            add_header Content-Type text/plain;',
            '        }',
            '    }',
            '}',
            'EOF',
            '    ',
            '    log "✓ Nginx HTTPS configuration created"',
            '    ',
            '    # Reload Nginx to apply SSL configuration',
            '    log "Reloading Nginx with SSL configuration..."',
            '    if systemctl reload nginx; then',
            '        log "✓ Nginx reloaded successfully with SSL"',
            '    else',
            '        log "✗ Error: Failed to reload Nginx"',
            '        exit 1',
            '    fi',
            '    ',
            '    # Enable automatic certificate renewal',
            '    log "Enabling automatic certificate renewal..."',
            '    if systemctl enable certbot-renew.timer; then',
            '        log "✓ Certbot auto-renewal timer enabled"',
            '    else',
            '        log "⚠ Warning: Failed to enable certbot auto-renewal timer"',
            '    fi',
            '    ',
            '    if systemctl start certbot-renew.timer; then',
            '        log "✓ Certbot auto-renewal timer started"',
            '    else',
            '        log "⚠ Warning: Failed to start certbot auto-renewal timer"',
            '    fi',
            'else',
            '    log "⚠ Warning: Failed to obtain SSL certificate"',
            '    log "⚠ Continuing with HTTP-only configuration"',
            '    log "⚠ You can manually run: certbot --nginx -d ${DOMAIN_NAME}"',
            'fi',
            '',
            'log "✓ SSL certificate generation module completed"',
            ''
        );

        // Add PostgreSQL 15 installation module
        userData.addCommands(
            '# ==========================================',
            '# PostgreSQL 15 Installation Module',
            '# ==========================================',
            'log "Starting PostgreSQL 15 installation..."',
            '',
            '# Check if PostgreSQL is already installed',
            'if command -v psql >/dev/null 2>&1; then',
            '    log "⚠ PostgreSQL already installed, skipping installation"',
            'else',
            '    log "Installing PostgreSQL 15 packages..."',
            '    if dnf install -y postgresql15 postgresql15-server postgresql15-contrib; then',
            '        log "✓ PostgreSQL 15 packages installed successfully"',
            '    else',
            '        log "✗ Error: Failed to install PostgreSQL 15"',
            '        exit 1',
            '    fi',
            'fi',
            '',
            '# Initialize PostgreSQL database cluster if not already initialized',
            'log "Checking if PostgreSQL database cluster is initialized..."',
            'if [ ! -d "/var/lib/pgsql/data/base" ]; then',
            '    log "Initializing PostgreSQL database cluster..."',
            '    if sudo -u postgres /usr/bin/postgresql-setup --initdb; then',
            '        log "✓ PostgreSQL database cluster initialized successfully"',
            '    else',
            '        log "✗ Error: Failed to initialize PostgreSQL database cluster"',
            '        exit 1',
            '    fi',
            'else',
            '    log "⚠ PostgreSQL database cluster already initialized, skipping"',
            'fi',
            '',
            '# Configure PostgreSQL for production',
            'log "Configuring PostgreSQL settings..."',
            'cat > /var/lib/pgsql/data/postgresql.conf << \'EOF\'',
            '# PostgreSQL Configuration for t4g.micro (1GB RAM)',
            '# Connection Settings',
            'listen_addresses = \'localhost\'',
            'port = 5432',
            'max_connections = 50',
            '',
            '# Memory Settings (optimized for 1GB RAM)',
            'shared_buffers = 128MB',
            'effective_cache_size = 512MB',
            'maintenance_work_mem = 64MB',
            'work_mem = 2MB',
            '',
            '# Write Ahead Log',
            'wal_buffers = 4MB',
            'checkpoint_completion_target = 0.9',
            '',
            '# Query Planning',
            'random_page_cost = 1.1',
            'effective_io_concurrency = 200',
            '',
            '# Logging',
            'logging_collector = on',
            'log_directory = \'/var/log/postgresql\'',
            'log_filename = \'postgresql-%Y-%m-%d.log\'',
            'log_rotation_age = 1d',
            'log_rotation_size = 100MB',
            'log_line_prefix = \'%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h \'',
            'log_timezone = \'UTC\'',
            '',
            '# Locale and Formatting',
            'datestyle = \'iso, mdy\'',
            'timezone = \'UTC\'',
            'lc_messages = \'en_US.UTF-8\'',
            'lc_monetary = \'en_US.UTF-8\'',
            'lc_numeric = \'en_US.UTF-8\'',
            'lc_time = \'en_US.UTF-8\'',
            'default_text_search_config = \'pg_catalog.english\'',
            'EOF',
            '',
            'log "✓ PostgreSQL configuration file created"',
            '',
            '# Set ownership and permissions',
            'chown postgres:postgres /var/lib/pgsql/data/postgresql.conf',
            'chmod 600 /var/lib/pgsql/data/postgresql.conf',
            '',
            '# Create log directory',
            'mkdir -p /var/log/postgresql',
            'chown postgres:postgres /var/log/postgresql',
            'chmod 755 /var/log/postgresql',
            'log "✓ PostgreSQL log directory created"',
            '',
            '# Enable and start PostgreSQL service',
            'log "Enabling PostgreSQL service..."',
            'if systemctl enable postgresql; then',
            '    log "✓ PostgreSQL service enabled for automatic startup"',
            'else',
            '    log "✗ Error: Failed to enable PostgreSQL service"',
            '    exit 1',
            'fi',
            '',
            'log "Starting PostgreSQL service..."',
            'if systemctl start postgresql; then',
            '    log "✓ PostgreSQL service started successfully"',
            'else',
            '    log "✗ Error: Failed to start PostgreSQL service"',
            '    # Try to get more information',
            '    systemctl status postgresql',
            '    exit 1',
            'fi',
            '',
            '# Wait for PostgreSQL to be ready',
            'log "Waiting for PostgreSQL to be ready..."',
            'sleep 5',
            '',
            '# Verify PostgreSQL service is active',
            'log "Verifying PostgreSQL service status..."',
            'if systemctl is-active --quiet postgresql; then',
            '    log "✓ PostgreSQL service is active and running"',
            'else',
            '    log "✗ Error: PostgreSQL service is not active"',
            '    systemctl status postgresql',
            '    exit 1',
            'fi',
            '',
            '# Verify psql command is available',
            'log "Verifying PostgreSQL installation..."',
            'if command -v psql >/dev/null 2>&1; then',
            '    PSQL_VERSION=$(psql --version)',
            '    log "✓ PostgreSQL is available: $PSQL_VERSION"',
            'else',
            '    log "✗ Error: psql command not found"',
            '    exit 1',
            'fi',
            '',
            '# Retrieve database credentials from Secrets Manager',
            'log "Retrieving database credentials from Secrets Manager..."',
            `DB_SECRET=$(aws secretsmanager get-secret-value --secret-id ${this.databaseSecret.secretArn} --region ${this.region} --query SecretString --output text)`,
            'DB_USERNAME=$(echo $DB_SECRET | jq -r .username)',
            'DB_PASSWORD=$(echo $DB_SECRET | jq -r .password)',
            'DB_NAME=$(echo $DB_SECRET | jq -r .dbname)',
            'log "✓ Database credentials retrieved successfully"',
            '',
            '# Create database and user',
            'log "Creating database and user..."',
            'sudo -u postgres psql << EOF',
            '-- Create user if not exists',
            'DO \\$\\$',
            'BEGIN',
            '    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = \'$DB_USERNAME\') THEN',
            '        CREATE USER $DB_USERNAME WITH PASSWORD \'$DB_PASSWORD\';',
            '    END IF;',
            'END',
            '\\$\\$;',
            '',
            '-- Create database if not exists',
            'SELECT \'CREATE DATABASE $DB_NAME OWNER $DB_USERNAME\'',
            'WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = \'$DB_NAME\')\\gexec',
            '',
            '-- Grant privileges',
            'GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USERNAME;',
            'EOF',
            '',
            'if [ $? -eq 0 ]; then',
            '    log "✓ Database and user created successfully"',
            'else',
            '    log "✗ Error: Failed to create database and user"',
            '    exit 1',
            'fi',
            '',
            '# Test database connectivity',
            'log "Testing database connectivity..."',
            'if sudo -u postgres psql -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then',
            '    log "✓ Database connectivity test successful"',
            'else',
            '    log "✗ Error: Database connectivity test failed"',
            '    exit 1',
            'fi',
            '',
            'log "✓ PostgreSQL 15 installation module completed"',
            ''
        );

        // ============================================
        // INCREMENTAL DEVELOPMENT INSTRUCTIONS
        // ============================================
        // To add new installation modules without replacing the EC2 instance:
        // 1. Add new userData.addCommands() blocks below this comment
        // 2. Run: npm run build && npx cdk deploy img-manager-prod-ec2-stack --profile mighty
        // 3. The new commands will be appended to the UserData script
        // 4. IMPORTANT: UserData only runs on FIRST BOOT, so changes won't affect existing instances
        //    unless you manually run the commands via SSM or SSH
        //
        // To test changes on an existing instance:
        // - SSH into the instance and run commands manually
        // - Or use AWS Systems Manager Session Manager
        // - Or create a new test script and run it via SSM Run Command
        //
        // To force a full instance replacement (use sparingly):
        // - Change the USERDATA_VERSION constant above
        // - This will create a new instance with the updated UserData
        // ============================================

        // ============================================
        // EC2 INSTANCE CREATION
        // ============================================
        // COMMENT OUT THIS BLOCK to deploy stack changes without recreating the instance
        // UNCOMMENT to create/recreate the instance with updated UserData
        // ============================================
        
        this.instance = new Instance(this, identifyResource(resourcePrefix, 'ec2-instance-v2'), {
            instanceName: identifyResource(resourcePrefix, 'ec2-instance'),
            instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
            machineImage: MachineImage.latestAmazonLinux2023({
                cpuType: AmazonLinuxCpuType.ARM_64,
            }),
            vpc: props.vpc,
            vpcSubnets: { subnetType: SubnetType.PUBLIC },
            securityGroup: httpsSecurityGroup,
            role: ec2Role,
            userData: userData,
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: {
                        ebsDevice: {
                            volumeSize: 50,
                            volumeType: EbsDeviceVolumeType.GP3,
                            encrypted: true,
                            deleteOnTermination: true,
                            iops: 3000,
                            throughput: 125,
                        },
                    },
                },
            ],
        });

        // Add additional security groups
        this.instance.addSecurityGroup(httpSecurityGroup);
        this.instance.addSecurityGroup(sshSecurityGroup);

        // Add deployment target tag for CodeDeploy
        Tags.of(this.instance).add(
            identifyResource(resourcePrefix, 'deployment-target'),
            'true'
        );
        
        // ============================================
        // END EC2 INSTANCE CREATION
        // ============================================

        // ============================================
        // ELASTIC IP AND ASSOCIATION
        // ============================================
        // COMMENT OUT if instance creation is commented out above
        // ============================================
        
        // Elastic IP
        this.elasticIp = new CfnEIP(this, identifyResource(resourcePrefix, 'elastic-ip'), {
            domain: 'vpc',
            tags: [
                {
                    key: 'Name',
                    value: identifyResource(resourcePrefix, 'elastic-ip'),
                },
            ],
        });

        // Associate Elastic IP with EC2 instance
        new CfnEIPAssociation(this, identifyResource(resourcePrefix, 'eip-association'), {
            eip: this.elasticIp.ref,
            instanceId: this.instance.instanceId,
        });
        
        // ============================================
        // END ELASTIC IP AND ASSOCIATION
        // ============================================

        // Route 53 A Record
        const hostedZone = HostedZone.fromLookup(
            this,
            identifyResource(resourcePrefix, 'hosted-zone'),
            {
                domainName: props.hostedZoneName,
            },
        );

        new ARecord(this, identifyResource(resourcePrefix, 'a-record'), {
            zone: hostedZone,
            recordName: props.domainName,
            target: RecordTarget.fromIpAddresses(this.elasticIp.ref),
            ttl: Duration.seconds(300),
        });

        // Outputs
        new cdk.CfnOutput(this, 'InstanceId', {
            value: this.instance.instanceId,
            description: 'EC2 Instance ID',
        });

        new cdk.CfnOutput(this, 'ElasticIP', {
            value: this.elasticIp.ref,
            description: 'Elastic IP address',
        });

        new cdk.CfnOutput(this, 'DomainName', {
            value: props.domainName,
            description: 'Domain name',
        });
    }
}
