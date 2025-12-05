import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, StackProps, Tags } from 'aws-cdk-lib';
import {
    AmazonLinuxCpuType,
    CfnEIP,
    CfnEIPAssociation,
    EbsDeviceVolumeType,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    Peer,
    Port,
    SecurityGroup,
    SubnetType,
    UserData,
    Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {
    Effect,
    ManagedPolicy,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { identifyResource } from './config-util';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { AccessDefinition } from './access-definition';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

interface Ec2StackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly vpc: Vpc;
    readonly assetsBucket: Bucket;
    readonly deploymentArtifactsBucket?: Bucket;
    readonly cloudwatchLogs: LogGroup;
    readonly sshAccessDefinitions: AccessDefinition[];
    readonly domainName: string;
    readonly hostedZoneName: string;
    readonly secretsWildcardArn: string;
    readonly errorSNSTopicARN: string;
    readonly taskEnv: { [key: string]: string };
}

export class Ec2Stack extends cdk.Stack {
    readonly instance: Instance;
    readonly elasticIp: CfnEIP;
    readonly databaseSecret: Secret;

    constructor(scope: Construct, id: string, props: Ec2StackProps) {
        super(scope, id, props);

        const resourcePrefix = props.resourcePrefix;

        // Create database secret
        this.databaseSecret = new Secret(this, identifyResource(resourcePrefix, 'db-secret'), {
            secretName: identifyResource(resourcePrefix, 'ec2-database-credentials'),
            description: 'Database credentials for EC2 PostgreSQL instance',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    username: 'img_manager_user',
                    dbname: 'img_manager',
                    host: 'localhost',
                    port: 5432,
                }),
                generateStringKey: 'password',
                excludeCharacters: '"@/\\\'',
                passwordLength: 32,
            },
        });

        // Security Groups
        const httpsSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'ec2-https-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'ec2-https-sg'),
                vpc: props.vpc,
                description: 'Allow HTTPS traffic',
                allowAllOutbound: true,
            },
        );
        httpsSecurityGroup.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(443),
            'Allow HTTPS from anywhere',
        );

        const httpSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'ec2-http-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'ec2-http-sg'),
                vpc: props.vpc,
                description: 'Allow HTTP traffic for Certbot',
                allowAllOutbound: true,
            },
        );
        httpSecurityGroup.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(80),
            'Allow HTTP from anywhere',
        );

        const sshSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'ec2-ssh-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'ec2-ssh-sg'),
                vpc: props.vpc,
                description: 'Allow SSH from specific IPs',
                allowAllOutbound: true,
            },
        );

        // Add SSH access rules from access definitions
        props.sshAccessDefinitions.forEach((accessDef) => {
            sshSecurityGroup.addIngressRule(
                Peer.ipv4(accessDef.ipAddress),
                Port.tcp(22),
                `SSH access from ${accessDef.description}`,
            );
        });

        // IAM Role for EC2
        const ec2Role = new Role(this, identifyResource(resourcePrefix, 'ec2-role'), {
            roleName: identifyResource(resourcePrefix, 'ec2-role'),
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
            description: 'IAM role for EC2 instance with native deployment permissions',
        });

        // S3 permissions for deployment artifacts bucket
        if (props.deploymentArtifactsBucket) {
            props.deploymentArtifactsBucket.grantRead(ec2Role);
        } else {
            // Fallback permissions if bucket not provided
            ec2Role.addToPolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['s3:GetObject', 's3:ListBucket'],
                    resources: [
                        `arn:aws:s3:::${resourcePrefix}-deployment-artifacts`,
                        `arn:aws:s3:::${resourcePrefix}-deployment-artifacts/*`,
                    ],
                }),
            );
        }

        // S3 permissions for CodePipeline artifacts (auto-generated buckets)
        // CodePipeline creates buckets with various naming patterns, so we need broader permissions
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject', 's3:ListBucket'],
                resources: [
                    // Deployment artifacts bucket (created by DeploymentStack)
                    `arn:aws:s3:::${resourcePrefix}-deployment-artifacts`,
                    `arn:aws:s3:::${resourcePrefix}-deployment-artifacts/*`,
                    // CodePipeline auto-generated buckets (various patterns)
                    `arn:aws:s3:::${resourcePrefix}-depl-*`,
                    `arn:aws:s3:::${resourcePrefix}-depl-*/*`,
                    `arn:aws:s3:::codepipeline-${this.region}-*`,
                    `arn:aws:s3:::codepipeline-${this.region}-*/*`,
                    // Additional patterns for CodePipeline artifact buckets
                    `arn:aws:s3:::*-${resourcePrefix.toLowerCase()}-*`,
                    `arn:aws:s3:::*-${resourcePrefix.toLowerCase()}-*/*`,
                    `arn:aws:s3:::*imgmanager*`,
                    `arn:aws:s3:::*imgmanager*/*`,
                ],
            }),
        );

        // S3 permissions for assets bucket (read/write)
        props.assetsBucket.grantReadWrite(ec2Role);

        // S3 permissions for database migration bucket (if needed)
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
                resources: [
                    `arn:aws:s3:::${resourcePrefix}-db-backups`,
                    `arn:aws:s3:::${resourcePrefix}-db-backups/*`,
                ],
            }),
        );

        // CodeDeploy permissions for agent
        ec2Role.addToPolicy(
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
                resources: ['*'],
            }),
        );

        // Secrets Manager read permissions
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
                resources: [props.secretsWildcardArn, this.databaseSecret.secretArn],
            }),
        );

        // CloudWatch Logs write permissions
        props.cloudwatchLogs.grantWrite(ec2Role);
        
        // Additional CloudWatch Logs permissions needed by the application
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'logs:DescribeLogStreams',
                    'logs:DescribeLogGroups',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents',
                ],
                resources: [
                    props.cloudwatchLogs.logGroupArn,
                    `${props.cloudwatchLogs.logGroupArn}:*`,
                ],
            }),
        );

        // SNS publish permissions
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['sns:Publish'],
                resources: [props.errorSNSTopicARN],
            }),
        );

        // SSM permissions for Systems Manager
        ec2Role.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        );

        // Additional SSM permissions for deployment
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ssm:UpdateInstanceInformation',
                    'ssm:SendCommand',
                    'ssm:ListCommandInvocations',
                    'ssm:DescribeInstanceInformation',
                    'ssm:GetCommandInvocation',
                ],
                resources: ['*'],
            }),
        );

        // AMI creation permissions for backups
        ec2Role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ec2:CreateImage',
                    'ec2:CreateSnapshot',
                    'ec2:CreateTags',
                    'ec2:DescribeImages',
                    'ec2:DescribeInstances',
                    'ec2:DescribeSnapshots',
                    'ec2:DeregisterImage',
                    'ec2:DeleteSnapshot',
                ],
                resources: ['*'],
            }),
        );

        // User Data Script for Native Deployment
        const userData = UserData.forLinux();
        
        // Create environment variables string for the application
        const envVars = Object.entries(props.taskEnv)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Initialize UserData script with logging setup
        userData.addCommands(
            '#!/bin/bash',
            'set -e',
            '',
            '# Redirect all output to log file',
            'exec > >(tee -a /var/log/user-data.log)',
            'exec 2>&1',
            '',
            '# Logging function with timestamps',
            'log() {',
            '    echo "[$(date "+%Y-%m-%d %H:%M:%S")] $1"',
            '}',
            '',
            'log "=========================================="',
            'log "Starting EC2 initialization script"',
            'log "=========================================="',
            '',
            '# Environment variables',
            `REGION="${this.region}"`,
            `DOMAIN_NAME="${props.domainName}"`,
            `DB_SECRET_ARN="${this.databaseSecret.secretArn}"`,
            `ASSETS_BUCKET="${props.assetsBucket.bucketName}"`,
            `ERROR_SNS_TOPIC="${props.errorSNSTopicARN}"`,
            `LOG_GROUP_NAME="${props.cloudwatchLogs.logGroupName}"`,
            '',
            'log "Configuration loaded:"',
            'log "  Region: $REGION"',
            'log "  Domain: $DOMAIN_NAME"',
            'log "  Assets Bucket: $ASSETS_BUCKET"',
            '',
            '# ==========================================',
            '# System Update Module',
            '# ==========================================',
            'log "Starting system update..."',
            '',
            '# Update package manager',
            'log "Updating dnf package manager..."',
            'if dnf update -y --skip-broken; then',
            '    log "✓ System packages updated successfully"',
            'else',
            '    log "⚠ Warning: Some packages failed to update (continuing with --skip-broken)"',
            'fi',
            '',
            '# Install base utilities',
            'log "Installing base utilities..."',
            'BASE_UTILITIES="wget git unzip tar gzip jq htop vim cronie logrotate"',
            '',
            'if dnf install -y $BASE_UTILITIES; then',
            '    log "✓ Base utilities installed successfully"',
            'else',
            '    log "✗ Error: Failed to install base utilities"',
            '    exit 1',
            'fi',
            '',
            '# Verify installed utilities are available',
            'log "Verifying installed utilities..."',
            'MISSING_UTILITIES=""',
            '',
            'for util in wget git unzip tar gzip jq htop vim cronie logrotate; do',
            '    # Special handling for cronie (service name) vs cron (command)',
            '    if [ "$util" = "cronie" ]; then',
            '        if command -v crond >/dev/null 2>&1; then',
            '            log "  ✓ crond available"',
            '        else',
            '            log "  ✗ crond not found"',
            '            MISSING_UTILITIES="$MISSING_UTILITIES crond"',
            '        fi',
            '    elif command -v "$util" >/dev/null 2>&1; then',
            '        log "  ✓ $util available"',
            '    else',
            '        log "  ✗ $util not found"',
            '        MISSING_UTILITIES="$MISSING_UTILITIES $util"',
            '    fi',
            'done',
            '',
            'if [ -n "$MISSING_UTILITIES" ]; then',
            '    log "✗ Error: Missing utilities:$MISSING_UTILITIES"',
            '    exit 1',
            'fi',
            '',
            'log "✓ All base utilities verified successfully"',
            'log "System update module completed"',
            ''
        );

        // EC2 Instance (recreated for CodeDeploy agent fix)
        this.instance = new Instance(this, identifyResource(resourcePrefix, 'ec2-instance-v2'), {
            instanceName: identifyResource(resourcePrefix, 'ec2-instance'),
            instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
            machineImage: MachineImage.latestAmazonLinux2023({
                cpuType: AmazonLinuxCpuType.ARM_64,
            }),
            vpc: props.vpc,
            vpcSubnets: { subnetType: SubnetType.PUBLIC },
            securityGroup: httpsSecurityGroup,
            role: ec2Role,
            userData: userData,
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: {
                        ebsDevice: {
                            volumeSize: 50,
                            volumeType: EbsDeviceVolumeType.GP3,
                            encrypted: true,
                            deleteOnTermination: true,
                            iops: 3000,
                            throughput: 125,
                        },
                    },
                },
            ],
        });

        // Add additional security groups
        this.instance.addSecurityGroup(httpSecurityGroup);
        this.instance.addSecurityGroup(sshSecurityGroup);

        // Add deployment target tag for CodeDeploy
        Tags.of(this.instance).add(
            identifyResource(resourcePrefix, 'deployment-target'),
            'true'
        );

        // Elastic IP
        this.elasticIp = new CfnEIP(this, identifyResource(resourcePrefix, 'elastic-ip'), {
            domain: 'vpc',
            tags: [
                {
                    key: 'Name',
                    value: identifyResource(resourcePrefix, 'elastic-ip'),
                },
            ],
        });

        // Associate Elastic IP with EC2 instance
        new CfnEIPAssociation(this, identifyResource(resourcePrefix, 'eip-association'), {
            eip: this.elasticIp.ref,
            instanceId: this.instance.instanceId,
        });

        // Route 53 A Record
        const hostedZone = HostedZone.fromLookup(
            this,
            identifyResource(resourcePrefix, 'hosted-zone'),
            {
                domainName: props.hostedZoneName,
            },
        );

        new ARecord(this, identifyResource(resourcePrefix, 'a-record'), {
            zone: hostedZone,
            recordName: props.domainName,
            target: RecordTarget.fromIpAddresses(this.elasticIp.ref),
            ttl: Duration.seconds(300),
        });

        // Outputs
        new cdk.CfnOutput(this, 'InstanceId', {
            value: this.instance.instanceId,
            description: 'EC2 Instance ID',
        });

        new cdk.CfnOutput(this, 'ElasticIP', {
            value: this.elasticIp.ref,
            description: 'Elastic IP address',
        });

        new cdk.CfnOutput(this, 'DomainName', {
            value: props.domainName,
            description: 'Domain name',
        });
    }
}
