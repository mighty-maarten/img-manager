import * as path from 'path';
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { IFileService } from './types';
import { DeleteObjectOutput, GetObjectOutput } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class LocalFileService implements IFileService {
    constructor(public configService: AppConfigService) {}

    public async deleteFile(bucketName: string, key: string): Promise<DeleteObjectOutput> {
        const filePath = path.join(this.configService.localStoragePath, bucketName, key);
        if (fs.existsSync(filePath)) {
            await fs.unlinkSync(filePath);
        }
        return new Promise((resolve) => {
            return resolve({});
        });
    }

    public async uploadFile(bucketName: string, key: string, content: any): Promise<void> {
        const directory = key.split('/')[0];
        const fileName = key.split('/')[1];
        const fileDir = path.join(this.configService.localStoragePath, bucketName, directory);
        const filePath = path.resolve(fileDir, `${fileName}`);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
    }

    public async downloadFile(bucketName: string, key: string): Promise<GetObjectOutput> {
        const directory = key.split('/')[0];
        const fileName = key.split('/')[1];
        const fileDir = path.join(this.configService.localStoragePath, bucketName, directory);
        const filePath = path.resolve(fileDir, `${fileName}`);

        const file = await fs.promises.readFile(filePath);

        const getObjectOutput: GetObjectOutput = {
            Body: Readable.from(file),
        };

        return new Promise((resolve) => {
            return resolve(getObjectOutput);
        });
    }

    public async deleteFiles(bucketName: string, keys: string[]): Promise<DeleteObjectOutput> {
        await Promise.all(
            keys.map(async (key) => {
                const filePath = path.join(this.configService.localStoragePath, bucketName, key);
                if (fs.existsSync(filePath)) {
                    await fs.unlinkSync(filePath);
                }
            }),
        );

        return new Promise((resolve) => {
            return resolve({});
        });
    }

    public async getGetObjectSignedUrl(
        bucketName: string,
        key: string,
        _expiration?: number,
        _contentDisposition?: string,
    ): Promise<string> {
        const port = this.configService.appPort;
        // No encoding needed since @ is URL-safe
        return `http://localhost:${port}/assets/${key}`;
    }

    public async listObjects(bucketName: string, prefix: string): Promise<string[]> {
        const bucketPath = path.join(this.configService.localStoragePath, bucketName);
        const prefixPath = path.join(bucketPath, prefix);

        if (!fs.existsSync(prefixPath)) {
            return [];
        }

        const keys: string[] = [];
        const collectFiles = (dirPath: string) => {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    collectFiles(fullPath);
                } else {
                    // Convert absolute path to relative key
                    const relativePath = path.relative(bucketPath, fullPath);
                    // Normalize to use forward slashes (like S3 keys)
                    const key = relativePath.split(path.sep).join('/');
                    keys.push(key);
                }
            }
        };

        collectFiles(prefixPath);
        return keys;
    }
}
