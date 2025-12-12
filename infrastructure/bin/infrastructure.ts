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
import { DeploymentStack } from '../lib/deployment-stack';

/////////////////////////
///  ** PARAMETERS ** ///
/////////////////////////

// FIXED PARAMETERS //
const accountId = '964213726654';
const region = 'eu-west-1';
const repo = 'img-manager';
const repoOwner = 'mighty-maarten';
const githubTokenSecretId = '/cicd/github_token';
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
const allowedOrigins = ['https://img-manager.mighty.be'];

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

// EC2 STACK
const ec2Stack = new Ec2Stack(app, identifyResource(resourcePrefix, 'ec2-stack'), {
    resourcePrefix: resourcePrefix,
    vpc: vpcStack.vpc,
    assetsBucket: sharedStack.assetsBucket,
    deploymentArtifactsBucket: undefined, // Will be set after deployment stack is created
    cloudwatchLogs: sharedStack.cloudwatchLogs,
    sshAccessDefinitions: [
        new AccessDefinition('141.135.70.31/32', 'MT Home Office'),
        new AccessDefinition('81.82.210.111/32', 'Hatch Office'),
    ],
    domainName: domainName,
    hostedZoneName: hostedZoneName,
    secretsWildcardArn: secretsWildcardArn,
    errorSNSTopicARN: snsStack.snsTopicArn,
    env: {
        account: accountId,
        region: region,
    },
});

// DEPLOYMENT STACK
const deploymentStack = new DeploymentStack(
    app,
    identifyResource(resourcePrefix, 'deployment-stack'),
    {
        resourcePrefix: resourcePrefix,
        githubOwner: repoOwner,
        githubRepo: repo,
        githubBranch: repoBranch,
        githubTokenSecretId: githubTokenSecretId,
        deploymentTargetTag: identifyResource(resourcePrefix, 'deployment-target'),
        notificationTopicArn: snsStack.snsTopicArn,
        requireManualApproval: deployApprovalNeeded,
        environmentConfig: {
            domainName: domainName,
            allowDatabaseSetup: allowDatabaseSetup,
            nodeEnv: nodeEnvironment,
            allowedOrigins: allowedOrigins.join(','),
            isCloud: true,
            cloudwatchLogGroupName: sharedStack.cloudwatchLogs.logGroupName,
            snsErrorTopicArn: snsStack.snsTopicArn,
            assetsBucketName: sharedStack.assetsBucket.bucketName,
            awsRegion: region,
        },
        env: {
            account: accountId,
            region: region,
        },
    },
);

// Ensure deployment stack is created after EC2 stack
deploymentStack.addDependency(ec2Stack);
deploymentStack.addDependency(snsStack);

app.synth();
