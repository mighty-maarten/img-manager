# Deployment Scripts

This directory contains scripts used by AWS CodeDeploy to deploy the img-manager application to EC2 instances.

## Directory Structure

```
/opt/img-manager/
├── current/              # Current deployment (CodeDeploy target)
│   └── packages/api/
│       └── .env.build    # Build-time environment variables (from CodeBuild)
├── shared/               # Persistent data across deployments
│   ├── .env.production   # Merged environment file (build-time + runtime secrets)
│   ├── secrets-config.sh # DB_SECRET_ARN and AWS_REGION for deployment scripts
│   └── storage/          # Local file storage
├── releases/             # Previous deployment versions
└── ...

/var/log/img-manager/     # Application logs
├── api-out.log
└── api-error.log
```

## Environment Configuration

The application uses a two-phase environment configuration approach:

### Phase 1: Build-Time Variables (CodeBuild)

Non-sensitive configuration is injected during the build phase via CodeBuild environment variables. These are defined in the CDK `DeploymentStack` and written to `.env.build`:

| Variable | Description | Source |
|----------|-------------|--------|
| `NODE_ENV` | Node environment (production) | CDK environmentConfig |
| `APP_PORT` | Application port (3000) | Hardcoded |
| `APP_ALLOW_DATABASE_SETUP` | Allow database setup | CDK environmentConfig |
| `APP_ALLOWED_ORIGINS` | CORS allowed origins | CDK environmentConfig |
| `APP_IS_CLOUD` | Cloud deployment flag | CDK environmentConfig |
| `APP_CLOUDWATCH_LOG_GROUP_NAME` | CloudWatch log group | CDK environmentConfig |
| `APP_SNS_ERROR_TOPIC_ARN` | SNS topic for errors | CDK environmentConfig |
| `APP_ASSETS_BUCKET_NAME` | S3 bucket for assets | CDK environmentConfig |
| `APP_LOCAL_STORAGE_PATH` | Local storage path | Hardcoded |
| `AWS_REGION` | AWS region | CDK environmentConfig |
| `DOMAIN_NAME` | Application domain | CDK environmentConfig |

### Phase 2: Runtime Secrets (CodeDeploy)

Sensitive credentials are retrieved from AWS Secrets Manager during deployment and merged with build-time variables:

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_HOST` | Database host | Hardcoded (localhost) |
| `DATABASE_PORT` | Database port | Hardcoded (5432) |
| `DATABASE_NAME` | Database name | Secrets Manager |
| `DATABASE_USERNAME` | Database username | Secrets Manager |
| `DATABASE_PASSWORD` | Database password | Secrets Manager |
| `JWT_SECRET` | JWT signing secret | Generated at deploy time |

## Deployment Scripts

### merge-env.sh
Merges build-time configuration with runtime secrets.
- Reads `.env.build` from deployment artifact
- Retrieves database credentials from AWS Secrets Manager
- Generates JWT secret
- Creates merged `.env.production` file
- Sets secure file permissions (600)
- Validates all required variables are present

### validate-env.sh
Validates the environment configuration file.
- Checks all required build-time variables are present
- Checks all required runtime variables are present
- Used by merge-env.sh to validate the merged configuration

### after-install.sh
Runs after CodeDeploy copies files to the instance.
- Calls merge-env.sh to create the merged environment file
- Copies client dist to API static directory
- Sets correct file permissions

### start.sh
Starts the application using PM2.
- Loads NVM environment
- Verifies merged `.env.production` exists and is valid
- Creates symlink to shared .env.production
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

1. **ApplicationStop** - Stops the running application (stop.sh)
2. **DownloadBundle** - Downloads the deployment package from S3
3. **BeforeInstall** - (not used)
4. **Install** - Copies files to `/opt/img-manager/current`
5. **AfterInstall** - Runs after-install.sh (merges env, copies client)
6. **ApplicationStart** - Runs start.sh to start the application
7. **ValidateService** - (not used, but PM2 monitors the app)

## Adding New Environment Variables

### Build-Time Variables (non-sensitive)

1. Add the variable to `EnvironmentConfig` interface in `infrastructure/lib/deployment-stack.ts`
2. Add the variable to `environmentVariables` in the CodeBuild project configuration
3. Add the variable to `buildspec.yml` in the `.env.build` generation section
4. Add the variable to `REQUIRED_BUILD_VARS` in `deploy/validate-env.sh`
5. Deploy the deployment stack: `cdk deploy img-manager-prod-deployment-stack --profile mighty`

### Runtime Variables (sensitive)

1. Store the secret in AWS Secrets Manager
2. Update `deploy/merge-env.sh` to retrieve and append the variable
3. Add the variable to `REQUIRED_RUNTIME_VARS` in `deploy/validate-env.sh`

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

### Check environment configuration
```bash
# View the build-time config (from deployment artifact)
cat /opt/img-manager/current/packages/api/.env.build

# View the merged production config
sudo cat /opt/img-manager/shared/.env.production

# View secrets configuration
cat /opt/img-manager/shared/secrets-config.sh
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

# Run after-install (includes merge-env.sh)
sudo -u ec2-user bash /opt/img-manager/current/deploy/after-install.sh

# Start application
sudo -u ec2-user bash /opt/img-manager/current/deploy/start.sh
```

### Common Issues

**Missing environment variables in .env.build**
- Ensure the deployment stack has been deployed with the latest environment config
- Check CodeBuild logs to see the generated .env.build content
- Verify the variable is defined in `infrastructure/lib/deployment-stack.ts`

**Secrets Manager access failure**
- Verify the EC2 instance role has permission to read the secret
- Check that `DB_SECRET_ARN` is correctly set in `/opt/img-manager/shared/secrets-config.sh`

**Validation failure**
- Check which variables are missing in the deployment logs
- Ensure all required variables are defined in both build-time and runtime phases

## Notes

- All scripts run as `ec2-user` (not root)
- NVM environment must be loaded in each script
- PM2 manages the application process
- Logs are written to `/var/log/img-manager/`
- Environment file is shared across deployments
- Sensitive credentials are NEVER stored in the deployment artifact
