# Requirements Document

## Introduction

This feature enables multi-environment support by separating environment configuration into build-time variables (non-sensitive configuration) and runtime secrets (sensitive credentials). Currently, the `.env.production` file is created during EC2 initialization with hardcoded values, which prevents deploying to multiple environments (dev, staging, production) without modifying the EC2 init script. This feature will allow environment-specific configuration to be injected at build time through CodeBuild, while sensitive credentials (database username/password) continue to be retrieved from AWS Secrets Manager at runtime.

## Glossary

- **Build-Time Variables**: Environment configuration values that are set during the CodeBuild phase and baked into the deployment artifact
- **Runtime Secrets**: Sensitive credentials (database username, password) that are retrieved from AWS Secrets Manager when the application starts
- **CodeBuild**: AWS service that compiles source code, runs tests, and produces deployment artifacts
- **Secrets Manager**: AWS service for securely storing and retrieving sensitive credentials
- **EC2 Init Script**: The user-data script that runs when an EC2 instance is first launched to configure the server
- **Environment File**: A `.env.production` file containing application configuration variables

## Requirements

### Requirement 1

**User Story:** As a DevOps engineer, I want to configure non-sensitive environment variables at build time, so that I can deploy the same application to multiple environments without modifying infrastructure scripts.

#### Acceptance Criteria

1. WHEN the CodeBuild project builds the application THEN the Build System SHALL inject environment-specific variables into the build process
2. WHEN the build completes THEN the Build System SHALL include a generated environment configuration file in the deployment artifact
3. WHEN environment variables are configured THEN the Build System SHALL support the following non-sensitive variables: APP_ALLOWED_ORIGINS, APP_IS_CLOUD, APP_CLOUDWATCH_LOG_GROUP_NAME, APP_SNS_ERROR_TOPIC_ARN, APP_ASSETS_BUCKET_NAME, AWS_REGION, DOMAIN_NAME
4. WHEN the deployment artifact is created THEN the Build System SHALL exclude sensitive credentials (DATABASE_USERNAME, DATABASE_PASSWORD) from the build-time configuration

### Requirement 2

**User Story:** As a DevOps engineer, I want sensitive database credentials to be injected at runtime from Secrets Manager, so that credentials are never stored in deployment artifacts or source control.

#### Acceptance Criteria

1. WHEN the application starts on the EC2 instance THEN the Deployment System SHALL retrieve database credentials from AWS Secrets Manager
2. WHEN credentials are retrieved THEN the Deployment System SHALL merge runtime secrets with build-time configuration into the final environment file
3. WHEN the final environment file is created THEN the Deployment System SHALL set file permissions to 600 (owner read/write only)
4. WHEN the application reads configuration THEN the Application SHALL use the merged environment file containing both build-time and runtime values

### Requirement 3

**User Story:** As a DevOps engineer, I want the EC2 init script to no longer create the full .env.production file, so that environment configuration is managed through the build and deployment pipeline.

#### Acceptance Criteria

1. WHEN the EC2 instance initializes THEN the EC2 Init Script SHALL create only the directory structure for environment files
2. WHEN the EC2 instance initializes THEN the EC2 Init Script SHALL NOT create a .env.production file with application configuration
3. WHEN the EC2 instance initializes THEN the EC2 Init Script SHALL continue to retrieve and store database credentials in a secure location for runtime injection

### Requirement 4

**User Story:** As a DevOps engineer, I want to configure environment-specific values through CDK stack parameters, so that I can manage multiple environments through infrastructure as code.

#### Acceptance Criteria

1. WHEN the DeploymentStack is instantiated THEN the CDK Stack SHALL accept environment configuration as stack properties
2. WHEN the CodeBuild project is created THEN the CDK Stack SHALL pass environment variables to the build project
3. WHEN environment values are not provided THEN the CDK Stack SHALL use sensible defaults for development environments
4. WHEN the stack is deployed THEN the CDK Stack SHALL output the configured environment values for verification

### Requirement 5

**User Story:** As a DevOps engineer, I want the deployment scripts to handle environment file generation, so that the correct configuration is applied during each deployment.

#### Acceptance Criteria

1. WHEN CodeDeploy runs the after-install hook THEN the Deployment Script SHALL generate the final .env.production file
2. WHEN generating the environment file THEN the Deployment Script SHALL combine build-time variables from the artifact with runtime secrets from Secrets Manager
3. WHEN the environment file generation fails THEN the Deployment Script SHALL fail the deployment and log the error
4. WHEN the environment file is generated successfully THEN the Deployment Script SHALL verify the file contains all required variables before starting the application
