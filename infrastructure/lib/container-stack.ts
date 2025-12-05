import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elasticloadbalancing from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as aws_applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, SecretValue, Stack, StackProps, TimeZone } from 'aws-cdk-lib';
import { InfraEnvironment } from './infra-environment';
import { identifyResource } from './config-util';
import { AccessDefinition } from './access-definition';
import { Artifact, ArtifactPath, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import {
    CodeBuildAction,
    EcsDeployAction,
    GitHubSourceAction,
    ManualApprovalAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Bucket } from 'aws-cdk-lib/aws-s3';

interface ECSStackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly environment: InfraEnvironment;
    readonly databaseSecurityGroup: SecurityGroup;
    readonly databaseSecretArn: string;
    readonly secretsWildcardArn: string;
    readonly domainName: string;
    readonly hostedZoneName: string;
    readonly ecsRepositoryName: string;
    readonly taskEnv: { [key: string]: string } | undefined;
    readonly vpc: Vpc;
    readonly assetsBucket: Bucket;
    readonly cloudwatchLogs: LogGroup;
    readonly sshAccessDefinitions: AccessDefinition[];
    readonly errorSNSTopicARN: string;
    readonly repo: string;
    readonly repoOwner: string;
    readonly repoBranch: string;
    readonly githubTokenSecretId: string;
    readonly buildAlertEmail: string;
    readonly useLatestTag: boolean;
    readonly deployApprovalNeeded: boolean;
    readonly memory: 512 | 1024 | 2048 | 4096 | 8192;
    readonly cpu: 256 | 512 | 1024 | 2048;
}

export class ContainerStack extends Stack {
    constructor(scope: Construct, id: string, props: ECSStackProps) {
        super(scope, id, props);
        const resourcePrefix = props.resourcePrefix;

        const vpc = props.vpc;

        const ecrRepository = new Repository(
            this,
            identifyResource(props.resourcePrefix, 'repository'),
            {
                repositoryName: props.ecsRepositoryName,
                // !!! CAUTION: setting this to true will destroy the entire repository in case of failure / destruction (unless it is not empty)
                removalPolicy: RemovalPolicy.DESTROY,
                lifecycleRules: [
                    {
                        description: 'Removes untagged images',
                        tagStatus: ecr.TagStatus.UNTAGGED,
                        maxImageCount: 1,
                    },
                    {
                        description: 'Removes release images > 5',
                        tagStatus: ecr.TagStatus.TAGGED,
                        maxImageCount: 5,
                        tagPrefixList: ['commit'],
                    },
                ],
            },
        );

        const cluster = new Cluster(this, identifyResource(resourcePrefix, 'cluster'), {
            clusterName: `${resourcePrefix}-cluster`,
            vpc: vpc,
        });

        // Load balancer resources
        const alb = new elasticloadbalancing.ApplicationLoadBalancer(
            this,
            identifyResource(resourcePrefix, 'alb'),
            {
                loadBalancerName: identifyResource(resourcePrefix, 'alb'),
                vpc: vpc,
                vpcSubnets: { subnets: vpc.publicSubnets },
                internetFacing: true,
                idleTimeout: Duration.minutes(10),
            },
        );

        const zone = HostedZone.fromLookup(this, identifyResource(resourcePrefix, 'zone'), {
            domainName: props.hostedZoneName,
        });

        new ARecord(this, identifyResource(resourcePrefix, 'domain'), {
            recordName: props.domainName,
            target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
            ttl: Duration.seconds(300),
            comment: `${props.environment} API domain`,
            zone: zone,
        });

        const targetGroupHttp = new elasticloadbalancing.ApplicationTargetGroup(
            this,
            identifyResource(resourcePrefix, 'target'),
            {
                port: 80,
                vpc: vpc,
                protocol: elasticloadbalancing.ApplicationProtocol.HTTP,
                targetType: elasticloadbalancing.TargetType.IP,
            },
        );

        targetGroupHttp.configureHealthCheck({
            path: '/status',
            protocol: elasticloadbalancing.Protocol.HTTP,
        });

        const certificate = new Certificate(this, identifyResource(resourcePrefix, 'certificate'), {
            domainName: props.domainName,
            subjectAlternativeNames: [`*.${props.domainName}`],
            validation: CertificateValidation.fromDns(zone),
        });

        const listener = alb.addListener(identifyResource(resourcePrefix, 'listener'), {
            open: true,
            port: 443,
            certificates: [certificate],
        });

        listener.addTargetGroups(identifyResource(resourcePrefix, 'target-group'), {
            targetGroups: [targetGroupHttp],
        });

        const elbSG = new ec2.SecurityGroup(this, identifyResource(resourcePrefix, 'alb-sg'), {
            vpc: vpc,
            allowAllOutbound: true,
        });

        elbSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow https traffic');
        alb.addSecurityGroup(elbSG);

        const dockerSecretPasswordKey = 'password';
        const dockerSecret = new secretsManager.Secret(
            this,
            identifyResource(resourcePrefix, 'docker-secret'),
            {
                secretName: identifyResource(resourcePrefix, 'docker-secret'),
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({}),
                    generateStringKey: dockerSecretPasswordKey,
                },
            },
        );

        const taskRole = new iam.Role(this, identifyResource(resourcePrefix, 'task-role'), {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            roleName: identifyResource(resourcePrefix, 'task-role'),
            description: 'Role that the api task definitions uses to run the api code',
        });

        const taskDefinition = new ecs.TaskDefinition(
            this,
            identifyResource(resourcePrefix, 'task'),
            {
                family: identifyResource(resourcePrefix, 'task'),
                compatibility: ecs.Compatibility.EC2_AND_FARGATE,
                cpu: props.cpu.toString(),
                memoryMiB: props.memory.toString(),
                networkMode: ecs.NetworkMode.AWS_VPC,
                taskRole: taskRole,
            },
        );

        const databaseSecret = secretsManager.Secret.fromSecretCompleteArn(
            this,
            identifyResource(resourcePrefix, 'imported-database-secret'),
            props.databaseSecretArn,
        );

        const image = ecs.RepositoryImage.fromEcrRepository(ecrRepository, 'latest');
        const container = taskDefinition.addContainer(
            identifyResource(resourcePrefix, 'container'),
            {
                containerName: identifyResource(resourcePrefix, 'container'),
                image: image,
                memoryLimitMiB: props.memory,
                environment: props.taskEnv,
                logging: ecs.LogDriver.awsLogs({ streamPrefix: resourcePrefix }),
                secrets: {
                    SSH_PASSWORD: ecs.Secret.fromSecretsManager(
                        dockerSecret,
                        dockerSecretPasswordKey,
                    ),
                    DATABASE_HOST: ecs.Secret.fromSecretsManager(databaseSecret, 'host'),
                    DATABASE_PORT: ecs.Secret.fromSecretsManager(databaseSecret, 'port'),
                    DATABASE_NAME: ecs.Secret.fromSecretsManager(databaseSecret, 'dbname'),
                    DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
                    DATABASE_USERNAME: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
                },
            },
        );

        container.addPortMappings({ containerPort: 80, hostPort: 80 });
        container.addPortMappings({ containerPort: 22, hostPort: 22 });

        const ecsSG = new ec2.SecurityGroup(this, identifyResource(resourcePrefix, 'ecs-sg'), {
            vpc: vpc,
            allowAllOutbound: true,
        });

        ecsSG.connections.allowFrom(elbSG, ec2.Port.allTcp(), 'Application load balancer');
        props.sshAccessDefinitions.forEach((ad) => {
            ecsSG.connections.allowFrom(
                ec2.Peer.ipv4(ad.ipAddress),
                ec2.Port.tcp(22),
                ad.description,
            );
        });

        const dbConsumerSecurityGroup = SecurityGroup.fromSecurityGroupId(
            this,
            identifyResource(resourcePrefix, 'db-consumer-sg'),
            props.databaseSecurityGroup.securityGroupId,
        );

        const peakTimeScalingTaskCounts = {
            [InfraEnvironment.DEV]: { min: 0, max: 0 },
            [InfraEnvironment.PROD]: { min: 1, max: 1 },
        };

        const downTimeScalingTaskCounts = {
            [InfraEnvironment.DEV]: { min: 0, max: 0 },
            [InfraEnvironment.PROD]: { min: 0, max: 0 },
        };

        const service = new ecs.FargateService(this, identifyResource(resourcePrefix, 'service'), {
            serviceName: identifyResource(resourcePrefix, 'service'),
            cluster,
            desiredCount: peakTimeScalingTaskCounts[props.environment].min,
            taskDefinition,
            securityGroups: [ecsSG, dbConsumerSecurityGroup],
            vpcSubnets: { subnetType: SubnetType.PUBLIC },
            assignPublicIp: true,
            enableExecuteCommand: true,
        });

        service.attachToApplicationTargetGroup(targetGroupHttp);

        taskRole.attachInlinePolicy(
            new iam.Policy(this, identifyResource(resourcePrefix, 'task-policy'), {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            's3:GetObject',
                            's3:GetBucketLocation',
                            's3:ListBucket',
                            's3:PutObject',
                            's3:DeleteObject',
                            's3:PutObjectAcl',
                        ],
                        resources: [
                            `${props.assetsBucket.bucketArn}`,
                            `${props.assetsBucket.bucketArn}/*`,
                        ],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'secretsmanager:GetResourcePolicy',
                            'secretsmanager:GetSecretValue',
                            'secretsmanager:DescribeSecret',
                            'secretsmanager:ListSecretVersionIds',
                        ],
                        resources: [props.secretsWildcardArn],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['secretsmanager:ListSecrets'],
                        resources: [`*`],
                    }),
                    new iam.PolicyStatement({
                        actions: ['secretsmanager:GetSecretValue'],
                        resources: [dockerSecret.secretArn, databaseSecret.secretArn],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['ecs:ExecuteCommand'],
                        resources: [
                            service.serviceArn,
                            cluster.clusterArn,
                            cluster.arnForTasks('*'),
                        ],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'ssmmessages:CreateControlChannel',
                            'ssmmessages:CreateDataChannel',
                            'ssmmessages:OpenControlChannel',
                            'ssmmessages:OpenDataChannel',
                        ],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                        resources: [props.cloudwatchLogs.logGroupArn],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['sns:Publish'],
                        resources: [props.errorSNSTopicARN],
                    }),
                ],
            }),
        );

        const scalableTarget = service.autoScaleTaskCount({
            minCapacity: peakTimeScalingTaskCounts[props.environment].min,
            maxCapacity: peakTimeScalingTaskCounts[props.environment].max,
        });

        scalableTarget.scaleOnMemoryUtilization(identifyResource(resourcePrefix, 'scale-up-mem'), {
            targetUtilizationPercent: 75,
        });

        scalableTarget.scaleOnCpuUtilization(identifyResource(resourcePrefix, 'scale-up-cpu'), {
            targetUtilizationPercent: 75,
        });

        scalableTarget.scaleOnSchedule(identifyResource(resourcePrefix, 'scale-up-scheduled'), {
            schedule: aws_applicationautoscaling.Schedule.cron({ hour: '9', minute: '0' }),
            minCapacity: peakTimeScalingTaskCounts[props.environment].min,
            maxCapacity: peakTimeScalingTaskCounts[props.environment].max,
            timeZone: TimeZone.EUROPE_BRUSSELS,
        });

        scalableTarget.scaleOnSchedule(identifyResource(resourcePrefix, 'scale-down-scheduled'), {
            schedule: aws_applicationautoscaling.Schedule.cron({ hour: '19', minute: '0' }),
            minCapacity: downTimeScalingTaskCounts[props.environment].min,
            maxCapacity: downTimeScalingTaskCounts[props.environment].max,
            timeZone: TimeZone.EUROPE_BRUSSELS,
        });

        // Source action
        const sourceOutput = new Artifact('SourceOutput');
        const sourceAction = new GitHubSourceAction({
            actionName: 'SOURCE',
            owner: props.repoOwner,
            repo: props.repo,
            branch: props.repoBranch,
            oauthToken: SecretValue.secretsManager(props.githubTokenSecretId, {
                jsonField: 'github-token',
            }),
            output: sourceOutput,
        });

        // Build actions
        const buildOutput = new Artifact('BuildOutput');
        const buildProject = this.createWebDeployProject(
            identifyResource(resourcePrefix, 'build-project'),
            resourcePrefix,
            cluster,
            ecrRepository,
            props.useLatestTag,
            container.containerName,
            props.buildAlertEmail,
        );
        const buildAction = new CodeBuildAction({
            actionName: 'BUILD',
            project: buildProject,
            input: sourceOutput,
            outputs: [buildOutput],
        });

        const deployAction = new EcsDeployAction({
            actionName: 'DEPLOY',
            service: service,
            imageFile: new ArtifactPath(buildOutput, `imagedefinitions.json`),
        });

        // Construct the pipeline
        const pipelineName = `${resourcePrefix}-deploy-pipeline`;
        const pipelineStages = [];
        pipelineStages.push({
            stageName: 'Source',
            actions: [sourceAction],
        });
        pipelineStages.push({
            stageName: 'Build',
            actions: [buildAction],
        });
        if (props.deployApprovalNeeded) {
            const manualApprovalAction = new ManualApprovalAction({
                actionName: 'APPROVE',
            });
            pipelineStages.push({
                stageName: 'Approve',
                actions: [manualApprovalAction],
            });
        }
        pipelineStages.push({
            stageName: 'Deploy',
            actions: [deployAction],
        });

        new Pipeline(this, pipelineName, {
            pipelineName,
            stages: pipelineStages,
        });
    }

    private createWebDeployProject(
        id: string,
        resourcePrefix: string,
        cluster: Cluster,
        ecrRepository: Repository,
        onlyUseLatestTag: boolean,
        containerName: string,
        buildAlertEmail: string,
    ) {
        const commands = onlyUseLatestTag
            ? ['env', 'export tag=latest']
            : ['env', 'export tag=commit-${CODEBUILD_RESOLVED_SOURCE_VERSION}'];
        const buildProject = new PipelineProject(this, id, {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: commands,
                    },
                    build: {
                        commands: [
                            onlyUseLatestTag
                                ? 'docker build -t $ecr_repo_uri:latest .'
                                : 'docker build -t $ecr_repo_uri:$tag -t $ecr_repo_uri:latest .',
                            'aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin $account_id.dkr.ecr.eu-west-1.amazonaws.com',
                            'docker push --all-tags $ecr_repo_uri',
                        ],
                    },
                    post_build: {
                        commands: [
                            'echo "in post-build stage"',
                            'cd ..',
                            `printf \'[{"name":"${containerName}","imageUri":"%s"}]\' $ecr_repo_uri:$tag > $CODEBUILD_SRC_DIR/imagedefinitions.json`,
                            'pwd; ls -al; cat $CODEBUILD_SRC_DIR/imagedefinitions.json',
                        ],
                    },
                },
                artifacts: {
                    files: ['imagedefinitions.json'],
                },
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_6_0,
                privileged: true,
            },
            environmentVariables: {
                cluster_name: {
                    value: `${cluster.clusterName}`,
                },
                ecr_repo_uri: {
                    value: `${ecrRepository.repositoryUri}`,
                },
                account_id: {
                    value: `${ecrRepository.repositoryUri}`,
                },
            },
        });

        ecrRepository.grantPullPush(buildProject.role!);
        buildProject.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    'ecs:describecluster',
                    'ecr:getauthorizationtoken',
                    'ecr:batchchecklayeravailability',
                    'ecr:batchgetimage',
                    'ecr:getdownloadurlforlayer',
                ],
                resources: [`${cluster.clusterArn}`],
            }),
        );

        // Add alert on build failure
        const alertsTopic = new Topic(this, `${resourcePrefix}-notifications`, {
            topicName: `${resourcePrefix}-notifications`,
            displayName: `${resourcePrefix} pipeline failures`,
        });
        new Subscription(this, `${resourcePrefix}-notifications-subscription`, {
            protocol: SubscriptionProtocol.EMAIL,
            endpoint: buildAlertEmail,
            topic: alertsTopic,
        });
        buildProject.onBuildFailed('onBuildFailed', { target: new SnsTopic(alertsTopic) });

        return buildProject;
    }
}
