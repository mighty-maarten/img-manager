#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StaticHostingStack } from '../lib/static-hosting-stack';
import { identifyResource } from '../lib/config-util';
import { InfraEnvironment } from '../lib/infra-environment';

/////////////////////////
///  ** PARAMETERS ** ///
/////////////////////////

// FIXED PARAMETERS //
const accountId = '964213726654';
const region = 'eu-west-1';
const repo = 'img-manager-client';
const repoOwner = 'mighty-maarten';
const githubTokenSecretId = '/cicd/github_token';
const buildAlertEmail = 'maarten.thoelen@mighty.be';

// VARIABLE PARAMETERS //
const infraEnvironment = InfraEnvironment.PROD;
const resourcePrefix = `img-manager-client-${infraEnvironment}`;
const repoBranch = 'releases';
const certificateArn =
    'arn:aws:acm:us-east-1:964213726654:certificate/e5689f63-802c-453e-bce6-965416e8642e';
const hostedZoneName = 'img-manager.mighty.be';
const domainNames = ['img-manager.mighty.be', 'www.img-manager.mighty.be'];
const apiUrl = 'https://api.img-manager.mighty.be';
const autoDestroyS3 = false;
const deployApprovalNeeded = true;

const app = new cdk.App();

/////////////////////
///  ** STACKS ** ///
/////////////////////

// STATIC HOSTING STACK //
new StaticHostingStack(app, identifyResource(resourcePrefix, 'static-hosting-stack'), {
    resourcePrefix: resourcePrefix,
    env: {
        account: accountId,
        region: region,
    },
    environment: infraEnvironment,
    repo: repo,
    repoBranch: repoBranch,
    repoOwner: repoOwner,
    githubTokenSecretId: githubTokenSecretId,
    buildAlertEmail: buildAlertEmail,
    certificateArn: certificateArn,
    hostedZoneName: hostedZoneName,
    domainNames: domainNames,
    environmentVariables: {
        VITE_API_URL: apiUrl,
    },
    autoDestroyS3: autoDestroyS3,
    deployApprovalNeeded: deployApprovalNeeded,
});

app.synth();
