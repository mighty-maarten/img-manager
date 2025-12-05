import { SecretsManager } from '@aws-sdk/client-secrets-manager';

export class SecretsUtil {
    public static async getSecret(secretId: string): Promise<any> {
        const secretManager = new SecretsManager({
            region: process.env.REGION,
        });
        const data = await secretManager.getSecretValue({ SecretId: secretId });
        return JSON.parse(data.SecretString!);
    }
}
