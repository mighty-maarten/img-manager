import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, StackProps } from 'aws-cdk-lib';
import { InstanceType, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
    Credentials,
    DatabaseInstance,
    DatabaseInstanceEngine,
    StorageType,
} from 'aws-cdk-lib/aws-rds';
import { identifyResource } from './config-util';
import { SubnetSelection } from 'aws-cdk-lib/aws-ec2/lib/vpc';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

interface RDSStackProps extends StackProps {
    readonly instanceType: InstanceType;
    readonly databaseName: string;
    readonly resourcePrefix: string;
    readonly deletionProtection: boolean;
    readonly vpc: Vpc;
    readonly subnetSelection: SubnetSelection;
}

export class RdsStack extends cdk.Stack {
    readonly consumerSecurityGroup: SecurityGroup;
    readonly databaseSecret: ISecret;

    constructor(scope: Construct, id: string, props: RDSStackProps) {
        super(scope, id, props);
        const resourcePrefix = props.resourcePrefix;

        this.consumerSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'db-consumer-sg'),
            {
                securityGroupName: identifyResource(resourcePrefix, 'db-consumer-sg'),
                vpc: props.vpc,
                allowAllOutbound: true,
            },
        );

        const databaseSecurityGroup = new SecurityGroup(
            this,
            identifyResource(resourcePrefix, 'db-sg'),
            {
                vpc: props.vpc,
                allowAllOutbound: true,
            },
        );
        databaseSecurityGroup.connections.allowFrom(
            this.consumerSecurityGroup,
            Port.tcp(5432),
            'DB consumer Ingress',
        );

        const databaseInstance = new DatabaseInstance(
            this,
            identifyResource(resourcePrefix, 'db-instance'),
            {
                engine: DatabaseInstanceEngine.POSTGRES,
                instanceIdentifier: identifyResource(resourcePrefix, 'db'),
                instanceType: props.instanceType,
                vpc: props.vpc,
                vpcSubnets: props.subnetSelection,
                securityGroups: [databaseSecurityGroup],
                storageEncrypted: true,
                multiAz: false,
                autoMinorVersionUpgrade: true,
                allocatedStorage: 100,
                storageType: StorageType.GP3,
                backupRetention: Duration.days(7),
                deletionProtection: props.deletionProtection,
                databaseName: props.databaseName,
                credentials: Credentials.fromGeneratedSecret(`${props.databaseName}_user`, {
                    secretName: identifyResource(resourcePrefix, 'db-secret'),
                }),
                port: 5432,
            },
        );
        this.databaseSecret = databaseInstance.secret!;
    }
}
