import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { InfraEnvironment } from './infra-environment';
import { identifyResource } from './config-util';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

interface SharedStackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly environment: InfraEnvironment;
    readonly autoDestroyS3: boolean;
}

export class SharedStack extends Stack {
    readonly assetsBucket: Bucket;
    readonly cloudwatchLogs: LogGroup;
    constructor(scope: Construct, id: string, props: SharedStackProps) {
        super(scope, id, props);
        const resourcePrefix = props.resourcePrefix;

        this.assetsBucket = new s3.Bucket(this, identifyResource(resourcePrefix, 'assets-bucket'), {
            bucketName: identifyResource(resourcePrefix, 'assets'),
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            cors: [
                {
                    allowedOrigins: [
                        'https://img-manager.mighty.be',
                        'https://d2soqqbdnq7pgs.cloudfront.net',
                    ],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag', 'Content-Length', 'Content-Type'],
                    maxAge: 3600,
                },
            ],

            // !!! CAUTION: setting this to DESTROY will destroy the entire S3 bucket in case of failure / destruction (unless it is not empty)
            removalPolicy: props.autoDestroyS3 ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
            // !!! CAUTION: setting this to true will clear the entire S3 bucket in case of failure / destruction
            autoDeleteObjects: props.autoDestroyS3,
        });

        this.cloudwatchLogs = new LogGroup(
            this,
            identifyResource(resourcePrefix, 'cloudwatch-logs'),
            {
                retention: RetentionDays.ONE_MONTH,
                logGroupName: identifyResource(resourcePrefix, 'cloudwatch-logs'),
            },
        );
    }
}
