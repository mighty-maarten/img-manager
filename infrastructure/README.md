# IMG Manager Infrastructure

AWS CDK infrastructure for the img-manager application.

## Architecture Overview

The infrastructure consists of the following stacks:

- **VPC Stack** - Network infrastructure (VPC, subnets, NAT gateways)
- **RDS Stack** - PostgreSQL database (optional, currently using EC2-hosted PostgreSQL)
- **Shared Stack** - S3 buckets, CloudWatch log groups
- **SNS Stack** - Error notification topics
- **EC2 Stack** - Application server with Nginx, Node.js, PostgreSQL
- **Deployment Stack** - CodePipeline, CodeBuild, CodeDeploy for CI/CD

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
- Node.js 22+
- AWS profile configured (e.g., `mighty`)

## Setup

```bash
cd infrastructure
npm install
```

## Deployment

### Deploy all stacks

```bash
npm run build
npx cdk deploy --all --profile mighty
```

### Deploy specific stack

```bash
npx cdk deploy img-manager-prod-ec2-stack --profile mighty
npx cdk deploy img-manager-prod-deployment-stack --profile mighty
```

## Environment Configuration

The application uses a two-phase environment configuration approach to separate non-sensitive configuration from sensitive credentials.

### Build-Time Variables

Non-sensitive configuration is defined in `infrastructure/bin/infrastructure.ts` and passed to the `DeploymentStack`:

```typescript
environmentConfig: {
    domainName: domainName,
    allowDatabaseSetup: String(allowDatabaseSetup),
    nodeEnv: nodeEnvironment,
    allowedOrigins: allowedOrigins.join(','),
    isCloud: true,
    cloudwatchLogGroupName: sharedStack.cloudwatchLogs.logGroupName,
    snsErrorTopicArn: snsStack.snsTopicArn,
    assetsBucketName: sharedStack.assetsBucket.bucketName,
    awsRegion: region,
}
```

These variables are:
1. Passed to CodeBuild as environment variables
2. Written to `.env.build` during the build phase
3. Included in the deployment artifact

### Runtime Secrets

Sensitive credentials are stored in AWS Secrets Manager and retrieved during deployment:

- **Database credentials** - Stored in `img-manager-prod-ec2-database-credentials`
- **JWT secret** - Generated at deployment time

The `merge-env.sh` script combines build-time variables with runtime secrets to create the final `.env.production` file.

### Adding New Environment Variables

#### Non-sensitive variables (build-time)

1. Add to `EnvironmentConfig` interface in `lib/deployment-stack.ts`:
   ```typescript
   export interface EnvironmentConfig {
       // ... existing fields
       readonly newVariable: string;
   }
   ```

2. Add to CodeBuild environment variables in `lib/deployment-stack.ts`:
   ```typescript
   environmentVariables: {
       // ... existing variables
       NEW_VARIABLE: { value: props.environmentConfig.newVariable },
   }
   ```

3. Add to `buildspec.yml`:
   ```yaml
   - echo "NEW_VARIABLE=${NEW_VARIABLE}" >> packages/api/.env.build
   ```

4. Add to `deploy/validate-env.sh` in `REQUIRED_BUILD_VARS` array

5. Pass the value in `bin/infrastructure.ts`:
   ```typescript
   environmentConfig: {
       // ... existing config
       newVariable: 'value',
   }
   ```

6. Deploy the deployment stack:
   ```bash
   npx cdk deploy img-manager-prod-deployment-stack --profile mighty
   ```

#### Sensitive variables (runtime)

1. Store in AWS Secrets Manager
2. Update `deploy/merge-env.sh` to retrieve and append the variable
3. Add to `deploy/validate-env.sh` in `REQUIRED_RUNTIME_VARS` array

## EC2 Instance Management

### Recreate EC2 Instance

To recreate the EC2 instance with updated user data:

1. Set `CREATE_INSTANCE = false` in `lib/ec2-stack.ts`
2. Deploy to destroy the instance:
   ```bash
   npx cdk deploy img-manager-prod-ec2-stack --profile mighty --exclusively
   ```
3. Set `CREATE_INSTANCE = true` and increment `USERDATA_VERSION`
4. Deploy to create new instance:
   ```bash
   npx cdk deploy img-manager-prod-ec2-stack --profile mighty --exclusively
   ```

### Update EC2 Init Script

The EC2 initialization script is stored in `scripts/ec2-init.sh` and uploaded to S3. To update:

1. Modify `scripts/ec2-init.sh`
2. Deploy the EC2 stack (script is uploaded via BucketDeployment)
3. For existing instances, the script won't re-run automatically
4. To apply changes to existing instances, either:
   - SSH in and run the script manually
   - Recreate the instance (see above)

## CI/CD Pipeline

The deployment pipeline is defined in `lib/deployment-stack.ts`:

1. **Source** - GitHub webhook triggers on push to main branch
2. **Build** - CodeBuild compiles the application and generates `.env.build`
3. **Approval** - Manual approval step (if enabled)
4. **Deploy** - CodeDeploy deploys to EC2 instances

### Trigger Pipeline Manually

```bash
aws codepipeline start-pipeline-execution \
    --name img-manager-prod-deployment-pipeline \
    --profile mighty \
    --region eu-west-1
```

## Stack Outputs

After deployment, useful outputs are displayed:

- `EnvDomainName` - Application domain
- `EnvAllowedOrigins` - CORS allowed origins
- `EnvAssetsBucketName` - S3 bucket for assets
- `EnvCloudwatchLogGroupName` - CloudWatch log group
- `EnvSnsErrorTopicArn` - SNS topic for errors

## Troubleshooting

### Check stack status

```bash
aws cloudformation describe-stacks \
    --stack-name img-manager-prod-deployment-stack \
    --profile mighty \
    --query 'Stacks[0].StackStatus'
```

### View CodeBuild logs

Check the AWS Console or use:
```bash
aws logs tail /aws/codebuild/img-manager-prod-build --profile mighty --follow
```

### View deployment logs on EC2

```bash
# SSH to instance
ssh ec2-user@img-manager.mighty.be

# Check deployment logs
sudo tail -f /opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log

# Check application logs
tail -f /var/log/img-manager/api-out.log
```

## File Structure

```
infrastructure/
├── bin/
│   └── infrastructure.ts    # CDK app entry point, stack configuration
├── lib/
│   ├── deployment-stack.ts  # CI/CD pipeline (CodePipeline, CodeBuild, CodeDeploy)
│   ├── ec2-stack.ts         # EC2 instance, security groups, IAM roles
│   ├── vpc-stack.ts         # VPC, subnets, NAT gateways
│   ├── shared.stack.ts      # S3 buckets, CloudWatch logs
│   ├── sns-stack.ts         # SNS topics for notifications
│   └── ...
├── scripts/
│   └── ec2-init.sh          # EC2 user data initialization script
└── ...
```
