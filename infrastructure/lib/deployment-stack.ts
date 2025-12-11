import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackProps } from 'aws-cdk-lib';
import {
    ServerApplication,
    ServerDeploymentGroup,
    ServerDeploymentConfig,
    InstanceTagSet,
} from 'aws-cdk-lib/aws-codedeploy';
import {
    Pipeline,
    Artifact,
} from 'aws-cdk-lib/aws-codepipeline';
import {
    GitHubSourceAction,
    CodeBuildAction,
    CodeDeployServerDeployAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import {
    PipelineProject,
    LinuxBuildImage,
    BuildSpec,
    ComputeType,
} from 'aws-cdk-lib/aws-codebuild';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { identifyResource } from './config-util';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import * as targets from 'aws-cdk-lib/aws-events-targets';

/**
 * Configuration for environment-specific variables that are injected at build time.
 * These are non-sensitive values that can be safely included in deployment artifacts.
 */
export interface EnvironmentConfig {
    /** The domain name for the application (e.g., 'api.example.com') */
    readonly domainName: string;
     /** The node environment for the application (e.g., 'production') */
    readonly nodeEnv: string;
    /** Comma-separated list of allowed CORS origins */
    readonly allowedOrigins: string;
    /** Whether it is allowed to perform a database setup */
    readonly allowDatabaseSetup: boolean;
    /** Whether the application is running in cloud mode */
    readonly isCloud: boolean;
    /** CloudWatch log group name for application logs */
    readonly cloudwatchLogGroupName: string;
    /** SNS topic ARN for error notifications */
    readonly snsErrorTopicArn: string;
    /** S3 bucket name for storing assets */
    readonly assetsBucketName: string;
    /** AWS region for the deployment */
    readonly awsRegion: string;
}

interface DeploymentStackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly githubOwner: string;
    readonly githubRepo: string;
    readonly githubBranch: string;
    readonly githubTokenSecretId: string;
    readonly deploymentTargetTag: string;
    readonly notificationTopicArn: string;
    readonly requireManualApproval?: boolean;
    /** Environment configuration for build-time variables */
    readonly environmentConfig: EnvironmentConfig;
}

export class DeploymentStack extends cdk.Stack {
    readonly codeDeployApplication: ServerApplication;
    readonly deploymentGroup: ServerDeploymentGroup;
    readonly pipeline: Pipeline;
    readonly artifactsBucket: Bucket;

    constructor(scope: Construct, id: string, props: DeploymentStackProps) {
        super(scope, id, props);

        const resourcePrefix = props.resourcePrefix;

        // ==========================================
        // S3 BUCKET FOR ARTIFACTS
        // ==========================================
        this.artifactsBucket = new Bucket(this, identifyResource(resourcePrefix, 'artifacts'), {
            bucketName: identifyResource(resourcePrefix, 'deployment-artifacts'),
            versioned: true,
            encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [
                {
                    id: 'DeleteOldArtifacts',
                    enabled: true,
                    expiration: cdk.Duration.days(30),
                },
            ],
        });

        // ==========================================
        // SNS TOPIC FOR PIPELINE NOTIFICATIONS
        // ==========================================
        // Use existing SNS topic from infrastructure
        const pipelineTopic = Topic.fromTopicArn(
            this,
            identifyResource(resourcePrefix, 'pipeline-topic'),
            props.notificationTopicArn,
        );

        // ==========================================
        // CODEDEPLOY APPLICATION
        // ==========================================
        this.codeDeployApplication = new ServerApplication(
            this,
            identifyResource(resourcePrefix, 'codedeploy-app'),
            {
                applicationName: identifyResource(resourcePrefix, 'app'),
            },
        );

        // ==========================================
        // CODEDEPLOY DEPLOYMENT GROUP
        // ==========================================
        this.deploymentGroup = new ServerDeploymentGroup(
            this,
            identifyResource(resourcePrefix, 'deployment-group'),
            {
                application: this.codeDeployApplication,
                deploymentGroupName: identifyResource(resourcePrefix, 'ec2-deployment-group'),
                deploymentConfig: ServerDeploymentConfig.ALL_AT_ONCE,
                ec2InstanceTags: new InstanceTagSet({
                    [props.deploymentTargetTag]: ['true'],
                }),
                installAgent: false, // Agent is already installed via UserData
                autoRollback: {
                    failedDeployment: true,
                    stoppedDeployment: true,
                },
            },
        );

        // ==========================================
        // CODEBUILD PROJECT
        // ==========================================
        const buildRole = new Role(this, identifyResource(resourcePrefix, 'build-role'), {
            roleName: identifyResource(resourcePrefix, 'codebuild-role'),
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
            description: 'IAM role for CodeBuild project',
        });

        // Add CloudWatch Logs permissions
        buildRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents',
                ],
                resources: [
                    `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/codebuild/${resourcePrefix}-*`,
                ],
            }),
        );

        // Add S3 permissions for artifacts
        this.artifactsBucket.grantReadWrite(buildRole);

        const buildProject = new PipelineProject(
            this,
            identifyResource(resourcePrefix, 'build-project'),
            {
                projectName: identifyResource(resourcePrefix, 'build'),
                role: buildRole,
                environment: {
                    buildImage: LinuxBuildImage.AMAZON_LINUX_2_ARM_3,
                    computeType: ComputeType.SMALL,
                    privileged: false,
                    environmentVariables: {
                        NODE_ENV: { value: props.environmentConfig.nodeEnv },
                        DOMAIN_NAME: { value: props.environmentConfig.domainName },
                        APP_ALLOWED_ORIGINS: { value: props.environmentConfig.allowedOrigins },
                        APP_ALLOW_DATABASE_SETUP: { value: props.environmentConfig.allowDatabaseSetup },
                        APP_IS_CLOUD: { value: String(props.environmentConfig.isCloud) },
                        APP_CLOUDWATCH_LOG_GROUP_NAME: { value: props.environmentConfig.cloudwatchLogGroupName },
                        APP_SNS_ERROR_TOPIC_ARN: { value: props.environmentConfig.snsErrorTopicArn },
                        APP_ASSETS_BUCKET_NAME: { value: props.environmentConfig.assetsBucketName },
                        AWS_REGION: { value: props.environmentConfig.awsRegion },
                    },
                },
                buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
                cache: cdk.aws_codebuild.Cache.local(
                    cdk.aws_codebuild.LocalCacheMode.SOURCE,
                    cdk.aws_codebuild.LocalCacheMode.CUSTOM,
                ),
            },
        );

        // ==========================================
        // CODEPIPELINE
        // ==========================================
        const pipelineRole = new Role(this, identifyResource(resourcePrefix, 'pipeline-role'), {
            roleName: identifyResource(resourcePrefix, 'codepipeline-role'),
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
            description: 'IAM role for CodePipeline',
        });

        // Add S3 permissions
        this.artifactsBucket.grantReadWrite(pipelineRole);

        // Add CodeBuild permissions
        pipelineRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'codebuild:BatchGetBuilds',
                    'codebuild:StartBuild',
                ],
                resources: [buildProject.projectArn],
            }),
        );

        // Add CodeDeploy permissions
        pipelineRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'codedeploy:CreateDeployment',
                    'codedeploy:GetApplication',
                    'codedeploy:GetApplicationRevision',
                    'codedeploy:GetDeployment',
                    'codedeploy:GetDeploymentConfig',
                    'codedeploy:RegisterApplicationRevision',
                ],
                resources: [
                    this.codeDeployApplication.applicationArn,
                    this.deploymentGroup.deploymentGroupArn,
                    `arn:aws:codedeploy:${this.region}:${this.account}:deploymentconfig:*`,
                ],
            }),
        );

        // Retrieve GitHub token from Secrets Manager
        const githubToken = Secret.fromSecretNameV2(
            this,
            identifyResource(resourcePrefix, 'github-token'),
            props.githubTokenSecretId,
        );

        // Extract token from JSON structure: {"github-token":"ghp_..."}
        const githubTokenValue = githubToken.secretValueFromJson('github-token');

        // Create pipeline
        this.pipeline = new Pipeline(this, identifyResource(resourcePrefix, 'pipeline'), {
            pipelineName: identifyResource(resourcePrefix, 'deployment-pipeline'),
            role: pipelineRole,
            artifactBucket: this.artifactsBucket,
            restartExecutionOnUpdate: true,
        });

        // ==========================================
        // PIPELINE STAGES
        // ==========================================

        // Source Stage
        const sourceOutput = new Artifact('SourceOutput');
        this.pipeline.addStage({
            stageName: 'Source',
            actions: [
                new GitHubSourceAction({
                    actionName: 'GitHub_Source',
                    owner: props.githubOwner,
                    repo: props.githubRepo,
                    branch: props.githubBranch,
                    oauthToken: githubTokenValue,
                    output: sourceOutput,
                    trigger: cdk.aws_codepipeline_actions.GitHubTrigger.POLL,
                }),
            ],
        });

        // Build Stage
        const buildOutput = new Artifact('BuildOutput');
        this.pipeline.addStage({
            stageName: 'Build',
            actions: [
                new CodeBuildAction({
                    actionName: 'Build',
                    project: buildProject,
                    input: sourceOutput,
                    outputs: [buildOutput],
                }),
            ],
        });

        // Manual Approval Stage (optional)
        if (props.requireManualApproval) {
            this.pipeline.addStage({
                stageName: 'Approval',
                actions: [
                    new cdk.aws_codepipeline_actions.ManualApprovalAction({
                        actionName: 'Manual_Approval',
                        notificationTopic: pipelineTopic,
                        additionalInformation: 'Please review the build and approve deployment to production.',
                    }),
                ],
            });
        }

        // Deploy Stage
        this.pipeline.addStage({
            stageName: 'Deploy',
            actions: [
                new CodeDeployServerDeployAction({
                    actionName: 'Deploy_to_EC2',
                    input: buildOutput,
                    deploymentGroup: this.deploymentGroup,
                }),
            ],
        });

        // ==========================================
        // PIPELINE NOTIFICATIONS
        // ==========================================
        this.pipeline.onStateChange(
            identifyResource(resourcePrefix, 'pipeline-state-change'),
            {
                eventPattern: {
                    detail: {
                        state: ['FAILED', 'SUCCEEDED'],
                    },
                },
                target: new targets.SnsTopic(pipelineTopic),
            },
        );

        // ==========================================
        // OUTPUTS
        // ==========================================
        new cdk.CfnOutput(this, 'PipelineName', {
            value: this.pipeline.pipelineName,
            description: 'CodePipeline name',
        });

        new cdk.CfnOutput(this, 'CodeDeployApplicationName', {
            value: this.codeDeployApplication.applicationName,
            description: 'CodeDeploy application name',
        });

        new cdk.CfnOutput(this, 'DeploymentGroupName', {
            value: this.deploymentGroup.deploymentGroupName,
            description: 'CodeDeploy deployment group name',
        });

        new cdk.CfnOutput(this, 'ArtifactsBucketName', {
            value: this.artifactsBucket.bucketName,
            description: 'S3 bucket for deployment artifacts',
        });

        // ==========================================
        // ENVIRONMENT CONFIGURATION OUTPUTS
        // ==========================================
        new cdk.CfnOutput(this, 'EnvDomainName', {
            value: props.environmentConfig.domainName,
            description: 'Configured domain name for the application',
        });

        new cdk.CfnOutput(this, 'EnvAllowedOrigins', {
            value: props.environmentConfig.allowedOrigins,
            description: 'Configured CORS allowed origins',
        });

        new cdk.CfnOutput(this, 'EnvIsCloud', {
            value: String(props.environmentConfig.isCloud),
            description: 'Whether the application is running in cloud mode',
        });

        new cdk.CfnOutput(this, 'EnvCloudwatchLogGroupName', {
            value: props.environmentConfig.cloudwatchLogGroupName,
            description: 'Configured CloudWatch log group name',
        });

        new cdk.CfnOutput(this, 'EnvSnsErrorTopicArn', {
            value: props.environmentConfig.snsErrorTopicArn,
            description: 'Configured SNS error topic ARN',
        });

        new cdk.CfnOutput(this, 'EnvAssetsBucketName', {
            value: props.environmentConfig.assetsBucketName,
            description: 'Configured S3 assets bucket name',
        });

        new cdk.CfnOutput(this, 'EnvAwsRegion', {
            value: props.environmentConfig.awsRegion,
            description: 'Configured AWS region',
        });
    }
}
