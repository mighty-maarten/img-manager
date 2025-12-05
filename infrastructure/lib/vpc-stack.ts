import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { StackProps } from 'aws-cdk-lib';
import { identifyResource } from './config-util';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { SubnetConfiguration } from 'aws-cdk-lib/aws-ec2/lib/vpc';
import * as logs from 'aws-cdk-lib/aws-logs';

interface VPCStackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly availabilityZones: string[];
    readonly amountOfNATGateways: number;
}

export class VpcStack extends cdk.Stack {
    readonly vpc: Vpc;

    constructor(scope: Construct, id: string, props: VPCStackProps) {
        super(scope, id, props);

        const resourcePrefix = props.resourcePrefix;
        const subnetConfiguration: SubnetConfiguration[] = [
            {
                name: identifyResource(resourcePrefix, 'public-subnet'),
                subnetType: ec2.SubnetType.PUBLIC,
                cidrMask: 24,
                mapPublicIpOnLaunch: true,
            },
            {
                name: identifyResource(resourcePrefix, 'private-subnet'),
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                cidrMask: 24,
            },
        ];

        this.vpc = new ec2.Vpc(this, identifyResource(resourcePrefix, 'public-vpc'), {
            ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
            availabilityZones: props.availabilityZones,
            natGateways: props.amountOfNATGateways,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnetConfiguration: subnetConfiguration,
            flowLogs: {},
        });

        // Create a CloudWatch Log Group to store VPC Flow Logs
        const flowLogsGroup = new logs.LogGroup(
            this,
            identifyResource(resourcePrefix, 'flow-logs-group'),
            {
                retention: logs.RetentionDays.FIVE_DAYS,
            },
        );

        // Enable VPC Flow Logs
        new ec2.FlowLog(this, identifyResource(resourcePrefix, 'vpc-flow-logs'), {
            resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
            destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogsGroup),
        });
    }
}
