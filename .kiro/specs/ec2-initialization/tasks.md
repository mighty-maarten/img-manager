# Implementation Plan

- [x] 1. Create UserData script generator in CDK
  - Implement bash script generation in `infrastructure/lib/ec2-stack.ts`
  - Add logging function for timestamped output
  - Set up output redirection to `/var/log/user-data.log`
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 2. Implement system update module
  - Add commands to update dnf package manager
  - Install base utilities (wget, git, unzip, tar, gzip, jq, htop, vim, cronie, logrotate)
  - Use `--skip-broken` flag for package conflicts
  - Verify installed utilities are available
  - _Requirements: 7.1, 7.2_

- [x] 3. Checkpoint - Verify system update
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Nginx and Certbot installation
  - Add commands to install nginx and python3-certbot-nginx packages
  - Enable and start nginx service
  - Create initial HTTP-only nginx configuration
  - Create Certbot webroot directory at `/var/www/certbot`
  - Verify nginx service is active and running
  - Verify certbot command is available
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2_

- [x] 5. Checkpoint - Verify Nginx installation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement PostgreSQL 15 installation
  - Add commands to install postgresql15 and postgresql15-server packages
  - Initialize database cluster with `initdb`
  - Enable and start postgresql service
  - Configure postgresql.conf with production settings
  - Verify postgresql service is active and running
  - Verify psql command is available
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3_

- [x] 7. Checkpoint - Verify PostgreSQL installation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement NVM and Node.js installation
  - Download and install NVM for ec2-user
  - Configure shell environment to load NVM
  - Install Node.js version 22.15.1
  - Create system-wide NVM environment file at `/etc/profile.d/nvm.sh`
  - Verify node and npm commands are available
  - Verify correct Node.js version is installed
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.3, 7.4_

- [x] 9. Checkpoint - Verify Node.js installation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement PM2 installation and configuration
  - Install PM2 globally using npm
  - Install pm2-logrotate module
  - Configure log rotation (10MB max, 7 days retention)
  - Set up PM2 startup script for systemd
  - Enable pm2-ec2-user service
  - Verify pm2 command is available
  - Verify pm2-ec2-user service is enabled
  - _Requirements: 4.1, 4.2, 4.3, 7.2, 7.3_

- [x] 11. Checkpoint - Verify PM2 installation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement CodeDeploy agent installation
  - Install Ruby runtime
  - Download CodeDeploy agent installer for the instance region
  - Install CodeDeploy agent
  - Enable and start codedeploy-agent service
  - Verify agent status is active
  - Verify codedeploy-agent service is running
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.4_

- [x] 13. Checkpoint - Verify CodeDeploy agent installation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement application directory structure
  - Create `/opt/img-manager` directory structure
  - Create `/var/log/img-manager` for application logs
  - Set ownership to ec2-user:ec2-user
  - Set appropriate permissions (755 for directories)
  - Verify directories exist with correct permissions
  - _Requirements: 7.3_

- [x] 15. Implement environment configuration file generation
  - Create `.env` file at `/opt/img-manager/shared/.env`
  - Populate with database credentials from Secrets Manager
  - Include all required environment variables (NODE_ENV, PORT, DB_*, AWS_REGION, etc.)
  - Set file permissions to 600 for security
  - Verify .env file exists with correct permissions
  - _Requirements: 7.3_

- [x] 16. Implement deployment metadata file
  - Create `deployment_info.json` at `/opt/img-manager/shared/`
  - Include setup timestamp, domain name, versions, and system info
  - Retrieve instance metadata (instance ID, availability zone)
  - Verify metadata file exists and contains valid JSON
  - _Requirements: 6.4_

- [x] 17. Implement comprehensive verification module
  - Check command availability (node, npm, pm2, nginx, psql, certbot, aws)
  - Verify service status (postgresql, nginx, codedeploy-agent, crond)
  - Test database connectivity with `psql -c "SELECT 1;"`
  - Validate nginx configuration with `nginx -t`
  - Log verification results with ✓/✗ markers
  - _Requirements: 3.4, 4.3, 5.6, 6.1_

- [x] 18. Implement idempotency checks
  - Add package existence checks before installation
  - Skip installation if package already exists
  - Log skip messages for already-installed packages
  - Ensure script can be safely re-run
  - _Requirements: 6.2, 6.5_

- [x] 19. Implement error handling
  - Add error logging for each installation step
  - Exit with non-zero status code on critical failures
  - Continue with warnings for non-critical failures
  - Log specific error messages for troubleshooting
  - _Requirements: 1.5, 2.6, 3.5, 4.4, 5.7, 6.3_

- [x] 20. Add completion marker
  - Create `/var/log/user-data-completed` file on successful completion
  - Include completion timestamp and summary
  - Log all installed component versions
  - _Requirements: 6.4_

- [x] 21. Final checkpoint - Verify complete EC2 initialization
  - Ensure all tests pass, ask the user if questions arise.

## CI/CD Pipeline Deployment

- [x] 22. Create GitHub Personal Access Token
  - Generate GitHub token with `repo` scope
  - Store token in AWS Secrets Manager at `/cicd/github_token`
  - Verify token is accessible via AWS CLI
  - _Requirements: Pipeline authentication_

- [x] 23. Deploy Deployment Stack
  - Build CDK infrastructure code with `npm run build`
  - Deploy deployment stack with `npx cdk deploy img-manager-prod-deployment-stack`
  - Verify CloudFormation stack creation completes successfully
  - Review stack outputs (pipeline name, CodeDeploy app, artifacts bucket)
  - _Requirements: CI/CD infrastructure_

- [ ] 24. Verify CodePipeline creation
  - Check pipeline exists in AWS Console
  - Verify pipeline has 4 stages: Source, Build, Approval, Deploy
  - Confirm GitHub webhook is configured
  - Verify artifacts bucket is created with lifecycle policy
  - _Requirements: Pipeline infrastructure_

- [ ] 25. Verify CodeBuild project
  - Check CodeBuild project exists with correct name
  - Verify build environment (Amazon Linux 2, Node.js 22)
  - Confirm buildspec.yml is configured as build specification
  - Check IAM role has necessary permissions
  - _Requirements: Build infrastructure_

- [ ] 26. Verify CodeDeploy configuration
  - Check CodeDeploy application exists
  - Verify deployment group targets EC2 instances with correct tag
  - Confirm deployment configuration is ALL_AT_ONCE
  - Verify auto-rollback is enabled
  - Check EC2 instance appears in deployment group targets
  - _Requirements: Deployment infrastructure_

- [ ] 27. Verify SNS notifications
  - Check SNS topic is created
  - Confirm email subscription is pending/confirmed
  - Verify pipeline events are configured to publish to topic
  - _Requirements: Notification infrastructure_

- [ ] 28. Test manual pipeline execution
  - Trigger pipeline manually from AWS Console
  - Monitor Source stage: verify code is pulled from GitHub
  - Monitor Build stage: check CloudWatch Logs for build output
  - Monitor Approval stage: verify email notification is received
  - Approve deployment manually
  - Monitor Deploy stage: verify deployment to EC2 succeeds
  - _Requirements: End-to-end pipeline validation_

- [ ] 29. Verify deployment on EC2 instance
  - SSH into EC2 instance
  - Check application files exist at `/opt/img-manager/current/`
  - Verify PM2 is running the application: `pm2 list`
  - Check application logs: `tail -f /var/log/img-manager/api-out.log`
  - Verify application is accessible via domain
  - _Requirements: Deployment validation_

- [ ] 30. Test automatic pipeline trigger
  - Make a small change to repository (e.g., update README)
  - Commit and push to main branch
  - Verify pipeline automatically triggers
  - Monitor pipeline execution through all stages
  - Confirm deployment completes successfully
  - _Requirements: Webhook validation_

- [ ] 31. Verify deployment artifacts cleanup
  - Check artifacts bucket contains deployment artifacts
  - Verify lifecycle policy is configured (30 days expiration)
  - Confirm old artifacts are marked for deletion
  - _Requirements: Cost optimization_

- [ ] 32. Document deployment process
  - Review DEPLOYMENT.md for accuracy
  - Review infrastructure/DEPLOYMENT_STACK.md for completeness
  - Update any missing information or corrections
  - Document any environment-specific configurations
  - _Requirements: Documentation_

- [ ] 33. Final checkpoint - Verify complete CI/CD pipeline
  - Ensure all pipeline components are working
  - Verify automatic deployments trigger on code push
  - Confirm rollback works on failed deployments
  - Validate monitoring and notifications
  - Ask the user if questions arise.

## Environment Variable Configuration Fix

- [x] 34. Fix environment variable configuration in .env file
  - Fix JWT_SECRET generation to use proper shell command substitution
  - Ensure all required environment variables are properly set
  - Verify .env file contains all variables expected by the application
  - Test that the application can start successfully with the generated .env file
  - _Requirements: Environment configuration for application startup_