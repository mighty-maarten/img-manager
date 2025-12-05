import { IFileService } from './types';
import { AppConfigService } from '../config/app-config.service';
import { Injectable, Logger } from '@nestjs/common';
import {
    DeleteObjectOutput,
    GetObjectCommand,
    GetObjectOutput,
    ListObjectsV2Command,
    S3,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3({ region: process.env.region });
const s3Client = new S3Client({ region: process.env.region });

@Injectable()
export class CloudFileService implements IFileService {
    constructor(
        public configService: AppConfigService,
        private logger: Logger,
    ) {}

    public async deleteFile(bucketName: string, key: string): Promise<DeleteObjectOutput> {
        const params = {
            Bucket: bucketName,
            Key: key,
        };

        return s3.deleteObject(params);
    }

    public async deleteFiles(bucketName: string, keys: string[]): Promise<DeleteObjectOutput> {
        const params = {
            Bucket: bucketName,
            Delete: {
                Objects: keys.map((k) => {
                    return {
                        Key: k,
                    };
                }),
            },
        };

        return s3.deleteObjects(params);
    }

    public async uploadFile(bucketName: string, key: string, content: any): Promise<any> {
        this.logger.log(`Uploading file ${key} to bucket ${bucketName}`);
        return s3.putObject({
            Bucket: bucketName,
            Key: key,
            Body: content,
        });
    }

    public async getGetObjectSignedUrl(
        bucketName: string,
        key: string,
        expiration?: number,
        contentDisposition?: string,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        return await getSignedUrl(s3Client, command, {
            expiresIn: expiration,
            unsignableHeaders: new Set(contentDisposition ? ['content-disposition'] : []),
        });
    }

    public async downloadFile(bucketName: string, key: string): Promise<GetObjectOutput> {
        return s3.getObject({
            Bucket: bucketName,
            Key: key,
        });
    }

    public async listObjects(bucketName: string, prefix: string): Promise<string[]> {
        const keys: string[] = [];
        let continuationToken: string | undefined;

        do {
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            });

            const response = await s3Client.send(command);

            if (response.Contents) {
                for (const object of response.Contents) {
                    // Filter out directory markers (keys ending with '/')
                    if (object.Key && !object.Key.endsWith('/')) {
                        keys.push(object.Key);
                    }
                }
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);

        this.logger.log(
            `Listed ${keys.length} objects with prefix ${prefix} in bucket ${bucketName}`,
        );
        return keys;
    }
}
