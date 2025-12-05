# Design Document

## Overview

This design provides a comprehensive EC2 initialization solution using AWS CDK UserData scripts to automatically configure an Amazon Linux 2023 instance with all required dependencies for the img-manager application deployment. The solution follows AWS best practices and official documentation for each component installation, ensuring reliability and maintainability.

The initialization script will be embedded in the EC2 instance's UserData and executed on first boot, installing and configuring Nginx, Certbot, PostgreSQL 15, NVM, Node.js, PM2, and the CodeDeploy agent. The script is designed to be idempotent, well-logged, and resilient to common failure scenarios.

## Architecture

### High-Level Architecture

The EC2 initialization system consists of a single bash script executed via AWS EC2 UserData that orchestrates the installation and configuration of multiple components in a specific order to satisfy dependencies:

1. **System Update Phase**: Update package manager and install base utilities
2. **Web Server Phase**: Install and configure Nginx and Certbot
3. **Database Phase**: Install and configure PostgreSQL 15
4. **Runtime Phase**: Install NVM and Node.js
5. **Process Manager Phase**: Install and configure PM2
6. **Deployment Agent Phase**: Install and configure CodeDeploy agent
7. **Application Setup Phase**: Create directory structure and configuration files
8. **Verification Phase**: Validate all installations and service states

### Component Dependencies

```
System Update
    ↓
Nginx + Certbot (independent)
    ↓
PostgreSQL 15 (independent)
    ↓
NVM → Node.js
    ↓
PM2 (depends on Node.js)
    ↓
CodeDeploy Agent (depends on Ruby)
    ↓
Application Directory Structure
    ↓
Service Verification
```

### Integration Points

- **AWS CDK**: The UserData script is generated and injected by the CDK Ec2Stack
- **AWS Secrets Manager**: Database credentials are retrieved from Secrets Manager
- **AWS Systems Manager**: EC2 instance is registered with SSM for management
- **AWS CodeDeploy**: Agent is installed and configured to receive deployments
- **Route 53**: DNS records point to the instance's Elastic IP
- **Let's Encrypt**: SSL certificates are obtained via Certbot

## Components and Interfaces

### 1. UserData Script Generator (CDK)

**Location**: `infrastructure/lib/ec2-stack.ts`

**Responsibility**: Generate the bash initialization script and inject it into EC2 UserData

**Interface**:
```typescript
class Ec2Stack {
  constructor(props: Ec2StackProps) {
    const userData = UserData.forLinux();
    userData.addCommands(...scriptCommands);
  }
}
```

**Key Methods**:
- `addCommands()`: Adds bash commands to the UserData script
- Configuration variables are passed from CDK props (domain name, region, secrets, etc.)

### 2. Installation Modules

Each installation module is a section of the bash script responsible for installing and configuring a specific component.

#### 2.1 System Update Module

**Responsibility**: Update system packages and install base utilities

**Commands**:
- `dnf update -y --skip-broken`
- `dnf install -y wget git unzip tar gzip jq htop vim cronie logrotate`

**Error Handling**: Continue on package conflicts, log warnings

#### 2.2 Nginx and Certbot Module

**Responsibility**: Install web server and SSL certificate management

**Commands**:
- `dnf install -y nginx python3-certbot-nginx`
- `systemctl enable nginx`
- `systemctl start nginx`
- Configure initial HTTP-only nginx.conf for Certbot validation
- `certbot certonly --webroot` (conditional on non-localhost domain)

**Configuration Files**:
- `/etc/nginx/nginx.conf`: Initial HTTP configuration with Certbot webroot
- `/var/www/certbot`: Webroot directory for ACME challenges

**Error Handling**: Log errors, continue without SSL if Certbot fails

#### 2.3 PostgreSQL Module

**Responsibility**: Install and configure PostgreSQL 15 database

**Commands**:
- `dnf install -y postgresql15 postgresql15-server postgresql15-contrib`
- `sudo -u postgres initdb -D /var/lib/pgsql/15/data`
- `systemctl enable postgresql`
- `systemctl start postgresql`
- Create database and user with credentials from Secrets Manager

**Configuration Files**:
- `/var/lib/pgsql/15/data/postgresql.conf`: Production-optimized settings

**Configuration Parameters**:
- `listen_addresses = 'localhost'` (security)
- `max_connections = 50` (optimized for t4g.micro)
- `shared_buffers = 128MB` (memory optimization)
- `effective_cache_size = 512MB`
- Logging to `/var/log/postgresql`

**Error Handling**: Retry start on failure, fix permissions, log errors

#### 2.4 NVM and Node.js Module

**Responsibility**: Install Node Version Manager and Node.js runtime

**Commands**:
- `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`
- `nvm install 22.15.1`
- `nvm use 22.15.1`
- `nvm alias default 22.15.1`

**Installation Method**: Follows AWS official documentation for Node.js on EC2

**User Context**: Installed for `ec2-user` account

**Configuration Files**:
- `/etc/profile.d/nvm.sh`: System-wide NVM environment setup
- `/home/ec2-user/.nvm`: NVM installation directory

**Error Handling**: Log errors and exit if Node.js installation fails

#### 2.5 PM2 Module

**Responsibility**: Install and configure process manager for Node.js applications

**Commands**:
- `npm install -g pm2`
- `pm2 install pm2-logrotate`
- `pm2 set pm2-logrotate:max_size 10M`
- `pm2 set pm2-logrotate:retain 7`
- `pm2 startup systemd -u ec2-user --hp /home/ec2-user`
- `systemctl enable pm2-ec2-user`

**Configuration**:
- Log rotation: 10MB max size, 7 days retention, compression enabled
- Startup: systemd service for automatic restart on boot

**Error Handling**: Log errors and exit if PM2 installation fails

#### 2.6 CodeDeploy Agent Module

**Responsibility**: Install and configure AWS CodeDeploy agent

**Commands**:
- `dnf install -y ruby wget`
- `wget https://aws-codedeploy-{region}.s3.{region}.amazonaws.com/latest/install`
- `chmod +x ./install`
- `sudo ./install auto`
- `systemctl start codedeploy-agent`
- `systemctl enable codedeploy-agent`
- `systemctl is-active codedeploy-agent` (verification)

**Installation Method**: Follows AWS official CodeDeploy agent installation guide

**Error Handling**: Retry start on failure, log status, continue if agent fails

#### 2.7 Application Setup Module

**Responsibility**: Create directory structure and configuration files

**Directories Created**:
- `/opt/img-manager`: Main application directory
- `/opt/img-manager/shared`: Shared persistent data
- `/opt/img-manager/releases`: Deployment releases
- `/var/log/img-manager`: Application logs
- `/var/www/certbot`: Certbot webroot

**Configuration Files Created**:
- `/opt/img-manager/shared/.env`: Environment variables
- `/opt/img-manager/shared/health-check.sh`: Health check script
- `/opt/img-manager/shared/deployment_info.json`: Deployment metadata
- `/etc/logrotate.d/img-manager`: Log rotation configuration

**Permissions**:
- Owner: `ec2-user:ec2-user` for application directories
- Owner: `nginx:nginx` for webroot
- Mode: 755 for directories, 600 for .env file

#### 2.8 Verification Module

**Responsibility**: Validate all installations and service states

**Checks Performed**:
- Command availability: node, npm, pm2, nginx, psql, certbot, aws
- Service status: postgresql, nginx, codedeploy-agent, crond
- Database connectivity: `psql -d $DB_NAME -c "SELECT 1;"`
- Nginx configuration: `nginx -t`
- System resources: memory, disk, load average

**Output**: Detailed log with ✓ (success) or ✗ (failure) markers

### 3. Logging System

**Responsibility**: Provide comprehensive logging for troubleshooting

**Implementation**:
- All output redirected to `/var/log/user-data.log`
- Timestamped log entries via `log()` function
- Structured logging with clear phase markers
- Completion marker file: `/var/log/user-data-completed`

**Log Format**:
```
[YYYY-MM-DD HH:MM:SS] Log message
```

### 4. Configuration Management

**Responsibility**: Manage configuration values and secrets

**Configuration Sources**:
- CDK Props: Domain name, region, bucket names, SNS topics
- AWS Secrets Manager: Database credentials
- EC2 Instance Metadata: Instance ID, availability zone
- Environment Variables: Passed from CDK to UserData

**Configuration Files**:
- `.env`: Application environment variables
- `postgresql.conf`: Database configuration
- `nginx.conf`: Web server configuration

## Data Models

### Environment Configuration

```typescript
interface EnvironmentConfig {
  NODE_ENV: 'production';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  APP_NAME: string;
  DOMAIN_NAME: string;
  AWS_REGION: string;
  LOG_LEVEL: string;
  STORAGE_TYPE: 's3' | 'local';
  STORAGE_PATH: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_MAX: number;
}
```

### Database Secret

```typescript
interface DatabaseSecret {
  username: string;
  password: string;
  dbname: string;
  host: string;
  port: number;
}
```

### Deployment Metadata

```typescript
interface DeploymentInfo {
  initial_setup: boolean;
  setup_time: string; // ISO 8601 timestamp
  domain_name: string;
  node_version: string;
  postgresql_version: string;
  nginx_version: string;
  system_info: {
    hostname: string;
    instance_id: string;
    availability_zone: string;
  };
}
```

### Service Status

```typescript
interface ServiceStatus {
  name: string;
  active: boolean;
  enabled: boolean;
  error?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

