# Deployment Scripts

This directory contains scripts used by AWS CodeDeploy to deploy the img-manager application to EC2 instances.

## Directory Structure

```
/opt/img-manager/
├── current/          # Current deployment (CodeDeploy target)
├── shared/           # Persistent data across deployments
│   ├── .env         # Environment configuration
│   └── deployment_info.json
├── releases/         # Previous deployment versions
└── ...

/var/log/img-manager/ # Application logs
├── api-out.log
└── api-error.log
```

## Deployment Scripts

### after-install.sh
Runs after CodeDeploy copies files to the instance.
- Creates symlink to shared .env file
- Replaces client environment variables
- Sets correct file permissions

### start.sh
Starts the application using PM2.
- Loads NVM environment
- Verifies .env file exists
- Starts application with PM2
- Saves PM2 process list

### stop.sh
Stops the application before deployment.
- Loads NVM environment
- Stops all PM2 processes gracefully

### app-start.config.js
PM2 configuration file for the application.
- Defines process name, script path, and environment
- Configures logging and restart behavior

## CodeDeploy Lifecycle

1. **ApplicationStop** - Stops the running application
2. **DownloadBundle** - Downloads the deployment package from S3
3. **BeforeInstall** - (not used)
4. **Install** - Copies files to `/opt/img-manager/current`
5. **AfterInstall** - Runs after-install.sh
6. **ApplicationStart** - Runs start.sh to start the application
7. **ValidateService** - (not used, but PM2 monitors the app)

## Environment Variables

The application expects a `.env.production` file at `/opt/img-manager/shared/.env.production` with:

```bash
NODE_ENV=production
PORT=3000
APP_NAME=img-manager
DOMAIN_NAME=your-domain.com
DB_HOST=localhost
DB_PORT=5432
DB_NAME=img_manager
DB_USERNAME=img_manager_user
DB_PASSWORD=<from-secrets-manager>
AWS_REGION=us-east-1
ASSETS_BUCKET=your-assets-bucket
ERROR_SNS_TOPIC=arn:aws:sns:...
LOG_GROUP_NAME=/aws/ec2/img-manager
STORAGE_TYPE=s3
STORAGE_PATH=/opt/img-manager/shared/storage
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
```

## Deployment Process

1. **Build Phase** (CodeBuild)
   - Installs dependencies
   - Builds client and API
   - Creates deployment artifact

2. **Deploy Phase** (CodeDeploy)
   - Stops current application
   - Downloads new version
   - Copies files to `/opt/img-manager/current`
   - Runs after-install.sh
   - Starts application with PM2

## Troubleshooting

### Check deployment logs
```bash
# CodeDeploy agent logs
sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log

# Deployment logs
sudo tail -f /opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log

# Application logs
tail -f /var/log/img-manager/api-out.log
tail -f /var/log/img-manager/api-error.log
```

### Check PM2 status
```bash
pm2 list
pm2 logs img-manager-api
pm2 monit
```

### Manual deployment test
```bash
# Stop application
sudo -u ec2-user bash /opt/img-manager/current/deploy/stop.sh

# Run after-install
sudo -u ec2-user bash /opt/img-manager/current/deploy/after-install.sh

# Start application
sudo -u ec2-user bash /opt/img-manager/current/deploy/start.sh
```

## Notes

- All scripts run as `ec2-user` (not root)
- NVM environment must be loaded in each script
- PM2 manages the application process
- Logs are written to `/var/log/img-manager/`
- Environment file is shared across deployments
