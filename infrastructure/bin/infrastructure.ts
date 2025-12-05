import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { identifyResource } from '../lib/config-util';
import { InfraEnvironment } from '../lib/infra-environment';
import { AccessDefinition } from '../lib/access-definition';
import { SharedStack } from '../lib/shared.stack';
import { VpcStack } from '../lib/vpc-stack';
import { RdsStack } from '../lib/rds-stack';
import { InstanceClass, InstanceSize, InstanceType, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { SnsStack } from '../lib/sns-stack';
import { Ec2Stack } from '../lib/ec2-stack';

/////////////////////////
///  ** PARAMETERS ** ///
/////////////////////////

// FIXED PARAMETERS //
const accountId = '964213726654';
const region = 'eu-west-1';
const repo = 'img-manager';
const repoOwner = 'mighty-maarten';
const githubTokenSecretId = '/cicd/github_token';
const buildAlertEmail = 'maarten.thoelen@mighty.be';
const errorAlertEmail = 'maarten.thoelen@mighty.be';

// VARIABLE PARAMETERS //
const infraEnvironment = InfraEnvironment.PROD;
const resourcePrefix = `img-manager-${infraEnvironment}`;
const repoBranch = 'main';
const databaseInstanceType = InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO);
const databaseSubnetSelection = { subnetType: SubnetType.PRIVATE_WITH_EGRESS };
const databaseDeletionProtection = true;
const databaseName = `img_manager_${infraEnvironment}`;
const autoDestroyS3 = false;
const availabilityZones = ['eu-west-1a', 'eu-west-1b'];
const amountOfNATGateways = 0;
const domainName = 'img-manager.mighty.be';
const hostedZoneName = 'img-manager.mighty.be';
const nodeEnvironment = 'production';
const deployApprovalNeeded = true;
const secretsWildcardArn = `arn:aws:secretsmanager:${region}:${accountId}:secret:${resourcePrefix}-*`;

const allowDatabaseSetup = true;
const allowedOrigins = ['https://img-manager.mighty.be', 'https://d2soqqbdnq7pgs.cloudfront.net/'];

const app = new cdk.App();

/////////////////////
///  ** STACKS ** ///
/////////////////////

// VPC STACK //
const vpcStack = new VpcStack(app, identifyResource(resourcePrefix, 'vpc-stack'), {
    resourcePrefix: resourcePrefix,
    amountOfNATGateways,
    availabilityZones,
    env: {
        account: accountId,
        region: region,
    },
});

// RDS DATABASE STACK //
const rdsStack = new RdsStack(app, identifyResource(resourcePrefix, 'rds-stack'), {
    resourcePrefix: resourcePrefix,
    env: {
        account: accountId,
        region: region,
    },
    vpc: vpcStack.vpc,
    databaseName: databaseName,
    instanceType: databaseInstanceType,
    subnetSelection: databaseSubnetSelection,
    deletionProtection: databaseDeletionProtection,
});

// SHARED RESOURCES STACK //
const sharedStack = new SharedStack(app, identifyResource(resourcePrefix, 'shared-stack'), {
    resourcePrefix: resourcePrefix,
    environment: infraEnvironment,
    autoDestroyS3,
    env: {
        account: accountId,
        region: region,
    },
});

// SNS STACK
const snsStack = new SnsStack(app, identifyResource(resourcePrefix, 'sns-stack'), {
    resourcePrefix: resourcePrefix,
    environment: infraEnvironment,
    alertMail: errorAlertEmail,
    env: {
        account: accountId,
        region: region,
    },
});

const ec2Stack = new Ec2Stack(app, identifyResource(resourcePrefix, 'ec2-stack'), {
    resourcePrefix: resourcePrefix,
    vpc: vpcStack.vpc,
    assetsBucket: sharedStack.assetsBucket,
    cloudwatchLogs: sharedStack.cloudwatchLogs,
    sshAccessDefinitions: [
        new AccessDefinition('141.135.70.31/32', 'MT Home Office'),
        new AccessDefinition('81.82.210.111/32', 'Hatch Office'),
    ],
    domainName: domainName,
    hostedZoneName: hostedZoneName,
    secretsWildcardArn: secretsWildcardArn,
    errorSNSTopicARN: snsStack.snsTopicArn,
    taskEnv: {
        NODE_ENV: nodeEnvironment,
        APP_ALLOW_DATABASE_SETUP: allowDatabaseSetup.toString(),
        APP_ALLOWED_ORIGINS: allowedOrigins.join(','),
        APP_PORT: '3000',
        APP_CLOUDWATCH_LOG_GROUP_NAME: sharedStack.cloudwatchLogs.logGroupName,
        APP_SNS_ERROR_TOPIC_ARN: snsStack.snsTopicArn,
        APP_IS_CLOUD: true.toString(),
        APP_ASSETS_BUCKET_NAME: sharedStack.assetsBucket.bucketName,
        APP_LOCAL_STORAGE_PATH: '/usr/app/storage',
        JWT_SECRET: 'this_is_a_secure_jwt_secret', // TODO @MT: Replace with a proper secret management solution
        JWT_EXPIRES_IN: '7days',
        DATABASE_SSL: false.toString(), // No SSL for localhost connection
        // Database configuration for local PostgreSQL (password will be added from Secrets Manager)
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_USERNAME: 'img_manager_user',
        DATABASE_NAME: 'img_manager',
        // Legacy environment variables (keeping for compatibility)
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        region: region,
    },
    env: {
        account: accountId,
        region: region,
    },
});

app.synth();
