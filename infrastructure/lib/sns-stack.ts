import { Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { identifyResource } from './config-util';
import { InfraEnvironment } from './infra-environment';

interface SnsStackProps extends StackProps {
    readonly resourcePrefix: string;
    readonly environment: InfraEnvironment;
    readonly alertMail: string;
}

export class SnsStack extends Stack {
    readonly snsTopicArn: string;

    constructor(scope: Construct, id: string, props: SnsStackProps) {
        super(scope, id, props);

        const onErrorTopic = new sns.Topic(
            this,
            identifyResource(props.resourcePrefix, 'on-error-topic'),
            { topicName: identifyResource(props.resourcePrefix, 'on-error-topic') },
        );

        onErrorTopic.addSubscription(new subscriptions.EmailSubscription(props.alertMail));
        this.snsTopicArn = onErrorTopic.topicArn;
    }
}
