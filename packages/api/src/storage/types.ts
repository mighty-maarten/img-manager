import { DeleteObjectOutput, GetObjectOutput } from '@aws-sdk/client-s3';

export const IFileService = 'IFileService';

export interface IFileService {
    downloadFile(bucketName: string, key: string): Promise<GetObjectOutput>;

    uploadFile(bucketName: string, key: string, content: any): Promise<void>;

    deleteFile(bucketName: string, key: string): Promise<DeleteObjectOutput>;

    deleteFiles(bucketName: string, keys: string[]): Promise<DeleteObjectOutput>;

    listObjects(bucketName: string, prefix: string): Promise<string[]>;

    getGetObjectSignedUrl(
        bucketName: string,
        key: string,
        expiration?: number,
        contentDisposition?: string,
    ): Promise<string>;
}
