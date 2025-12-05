import { App, Duration, RemovalPolicy, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import {
    Distribution,
    DistributionProps, HeadersFrameOption, HeadersReferrerPolicy,
    OriginAccessIdentity,
    ResponseHeadersPolicy,
    ViewerProtocolPolicy
} from 'aws-cdk-lib/aws-cloudfront';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, GitHubSourceAction, ManualApprovalAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Certificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { identifyResource } from './config-util';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';

interface StaticHostingProps extends StackProps {
    readonly resourcePrefix: string;
    readonly certificateArn?: string;
    readonly domainNames?: string[];
    readonly hostedZoneName?: string;
    readonly environmentVariables: { [key: string]: string };
    readonly environment: string;
    readonly repo: string;
    readonly repoOwner: string;
    readonly repoBranch: string;
    readonly githubTokenSecretId: string;
    readonly buildAlertEmail: string;
    readonly autoDestroyS3: boolean;
    readonly deployApprovalNeeded: boolean;
}

export class StaticHostingStack extends Stack {
    constructor(scope: App, id: string, props: StaticHostingProps) {
        super(scope, id, props);

        const resourcePrefix = props.resourcePrefix;

        // Create S3 Bucket
        const sourceBucket = new Bucket(this, identifyResource(resourcePrefix, 's3-bucket-website-assets'), {
            bucketName: `${resourcePrefix}-static`,
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
            // !!! CAUTION: setting this to DESTROY will destroy the entire S3 bucket in case of failure / destruction (unless it is not empty)
            removalPolicy: props.autoDestroyS3 ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
            // !!! CAUTION: setting this to true will clear the entire S3 bucket in case of failure / destruction
            autoDeleteObjects: props.autoDestroyS3
        });

        const logBucket = new Bucket(this, identifyResource(resourcePrefix, 's3-bucket-website-logs'), {
            bucketName: `${resourcePrefix}-logs`,
            objectOwnership: ObjectOwnership.OBJECT_WRITER,
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            publicReadAccess: false,
            // !!! CAUTION: setting this to DESTROY will destroy the entire S3 bucket in case of failure / destruction (unless it is not empty)
            removalPolicy: props.autoDestroyS3 ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
            // !!! CAUTION: setting this to true will clear the entire S3 bucket in case of failure / destruction
            autoDeleteObjects: props.autoDestroyS3
        });

        // Create Origin Access Identity
        const cloudFrontOia = new OriginAccessIdentity(this, identifyResource(resourcePrefix, 'origin-access-identity'), {
            comment: `OIA for ${resourcePrefix} website.`
        });
        sourceBucket.grantRead(cloudFrontOia);

        // Create CloudFront props
        const certificate: ICertificate | undefined = props.certificateArn
            ? Certificate.fromCertificateArn(this, identifyResource(resourcePrefix, 'certificate'), props.certificateArn)
            : undefined;
        const domainNames: string[] = props.certificateArn && props.domainNames
            ? props.domainNames
            : [];

        const responseHeadersPolicy = new ResponseHeadersPolicy(this, identifyResource(resourcePrefix, 'response-headers-policy'), {
            responseHeadersPolicyName: identifyResource(resourcePrefix, 'response-headers-policy'),
            customHeadersBehavior: {
                customHeaders: [
                    { header: 'Permissions-Policy', value: 'fullscreen=(self)', override: true }
                ]
            },
            securityHeadersBehavior: {
                contentSecurityPolicy: {
                    contentSecurityPolicy: 'default-src https:; img-src \'self\' https: data:; style-src \'self\' \'unsafe-inline\' fonts.googleapis.com; script-src \'self\' \'unsafe-inline\'',
                    override: true
                },
                contentTypeOptions: { override: true },
                frameOptions: { frameOption: HeadersFrameOption.SAMEORIGIN, override: true },
                referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.NO_REFERRER, override: true },
                strictTransportSecurity: {
                    accessControlMaxAge: Duration.seconds(31536000),
                    includeSubdomains: true,
                    override: true
                },
                xssProtection: {
                    protection: true,
                    modeBlock: true,
                    override: true
                }
            }
        });

        const cloudFrontDistProps: DistributionProps = {
            defaultBehavior: {
                origin: new S3Origin(sourceBucket, {
                    originAccessIdentity: cloudFrontOia
                }),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                responseHeadersPolicy: responseHeadersPolicy
            },
            domainNames: domainNames,
            certificate: certificate,
            defaultRootObject: 'index.html',
            enableLogging: true,
            logIncludesCookies: true,
            logBucket: logBucket,
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html'
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html'
                }
            ]
        };

        // Create CloudFront
        const cloudFrontDistribution = new Distribution(this, identifyResource(resourcePrefix, 'cloudfront-distribution'), cloudFrontDistProps);

        // Create A records
        if (props.hostedZoneName) {
            const zone = HostedZone.fromLookup(this, identifyResource(resourcePrefix, 'zone'), {
                domainName: props.hostedZoneName
            });

            if (props.domainNames) {
                props.domainNames.forEach(domainName => {
                    new ARecord(this, identifyResource(resourcePrefix, `domain-${domainName}`), {
                        recordName: domainName,
                        target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFrontDistribution)),
                        ttl: Duration.seconds(300),
                        comment: `${props.environment} domain: ${domainName}`,
                        zone: zone
                    });
                });
            }
        }

        // Source action
        const sourceOutput = new Artifact('SourceOutput');
        const sourceAction = new GitHubSourceAction({
            actionName: 'SOURCE',
            owner: props.repoOwner,
            repo: props.repo,
            branch: props.repoBranch,
            oauthToken: SecretValue.secretsManager(props.githubTokenSecretId, { jsonField: 'github-token' }),
            output: sourceOutput
        });

        // Add alert on build failure
        const alertsTopic = new Topic(this, `${resourcePrefix}-notifications`, {
            topicName: `${resourcePrefix}-notifications`,
            displayName: `${resourcePrefix} pipeline failures`
        });
        new Subscription(this, `${resourcePrefix}-notifications-subscription`, {
            protocol: SubscriptionProtocol.EMAIL,
            endpoint: props.buildAlertEmail,
            topic: alertsTopic
        });

        // Build actions
        const buildOutput = new Artifact('BuildOutput');
        const environmentVariables = Object.entries(props.environmentVariables)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ');
        const buildProject = this.createWebBuildProject(identifyResource(resourcePrefix, 'build-project'),environmentVariables, alertsTopic);
        const buildAction = new CodeBuildAction({
            actionName: 'BUILD',
            project: buildProject,
            input: sourceOutput,
            outputs: [buildOutput]
        });

        const deployProject = this.createWebDeployProject(identifyResource(resourcePrefix, 'deploy-project'),
            cloudFrontDistribution.distributionId, sourceBucket, alertsTopic);
        const deployAction = new CodeBuildAction({
            actionName: 'DEPLOY',
            project: deployProject,
            input: buildOutput
        });

        // Construct the pipeline
        const pipelineName = `${resourcePrefix}-deploy-pipeline`;
        const pipelineStages = [];
        pipelineStages.push({
            stageName: 'Source',
            actions: [sourceAction]
        });
        pipelineStages.push({
            stageName: 'Build',
            actions: [buildAction]
        });
        if (props.deployApprovalNeeded) {
            const manualApprovalAction = new ManualApprovalAction({
                actionName: 'APPROVE'
            });
            pipelineStages.push({
                stageName: 'Approve',
                actions: [manualApprovalAction]
            });
        }
        pipelineStages.push({
            stageName: 'Deploy',
            actions: [deployAction]
        });
        new Pipeline(this, pipelineName, {
            pipelineName,
            stages: pipelineStages
        });
    }

    private createWebBuildProject(id: string, environmentVariables: string, alertsTopic: Topic) {
        const buildProject = new PipelineProject(this, id, {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: '22'
                        },
                        commands: [
                            'npm ci'
                        ]
                    },
                    build: {
                        commands: [
                            `${environmentVariables} npm run build`
                        ]
                    }
                },
                artifacts: {
                    files: [
                        '**/*'
                    ]
                }
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_7_0
            }
        });

        buildProject.onBuildFailed('onBuildFailed', { target: new SnsTopic(alertsTopic) });
        return buildProject;
    }

    private createWebDeployProject(id: string, distributionId: string, staticBucket: Bucket, alertsTopic: Topic) {
        const deployProject = new PipelineProject(this, id, {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    build: {
                        commands: [
                            `aws s3 sync "dist" "s3://${staticBucket.bucketName}" --exclude "config.*.js" --delete`,
                            `AWS_MAX_ATTEMPTS=10 aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`
                        ]
                    }
                }
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_7_0
            }
        });

        // Create Bucket Policy
        const bucketPolicy = new PolicyStatement();
        bucketPolicy.addActions('s3:GetObject');
        bucketPolicy.addActions('s3:GetBucketLocation');
        bucketPolicy.addActions('s3:ListBucket');
        bucketPolicy.addActions('s3:PutObject');
        bucketPolicy.addActions('s3:DeleteObject');
        bucketPolicy.addActions('s3:PutObjectAcl');
        bucketPolicy.addResources(staticBucket.bucketArn);
        bucketPolicy.addResources(`${staticBucket.bucketArn}/*`);
        bucketPolicy.addArnPrincipal(deployProject.role!.roleArn);
        staticBucket.addToResourcePolicy(bucketPolicy);

        // Create Code Build Policy
        const codeBuildPolicy = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['cloudfront:CreateInvalidation'],
            resources: ['*']
        });
        deployProject.role?.addToPrincipalPolicy(codeBuildPolicy);

        deployProject.onBuildFailed('onBuildFailed', { target: new SnsTopic(alertsTopic) });
        return deployProject;
    }
}
