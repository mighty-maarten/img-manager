import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

export class SnsUtil {
    public static async logErrorMessageToSNS(
        errorTopicArn: string,
        message: string,
    ): Promise<void> {
        const client = new SNSClient({ region: process.env.REGION });

        await client.send(
            new PublishCommand({
                Message: message,
                TopicArn: errorTopicArn,
            }),
        );
    }
}
