import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';
import { IFileService } from '../storage/types';
import { ProcessedImage } from '../database/entities/processed-image.entity';
import { Label } from '../database/entities/label.entity';
import { MigrationResultContract } from './types';

@Injectable()
export class MigrationService {
    constructor(
        @Inject(IFileService) private readonly fileService: IFileService,
        private readonly configService: AppConfigService,
        @InjectRepository(ProcessedImage)
        private readonly processedImageRepository: Repository<ProcessedImage>,
        @InjectRepository(Label)
        private readonly labelRepository: Repository<Label>,
        private readonly logger: Logger,
    ) {}

    async migrateProcessedImagesToLabelFolders(
        dryRun: boolean = false,
    ): Promise<MigrationResultContract> {
        const bucketName = this.configService.assetsBucketName;
        const processedPrefix = 'processed/';

        this.logger.log(
            `Starting migration of processed images to label folders${dryRun ? ' (DRY RUN)' : ''}`,
        );

        // List all files in /processed/ root
        const allKeys = await this.fileService.listObjects(bucketName, processedPrefix);
        this.logger.log(`Found ${allKeys.length} total files with prefix '${processedPrefix}'`);

        // Filter to only root-level files (exclude subdirectories)
        // Root-level files: processed/filename.webp
        // Subdirectory files: processed/label/filename.webp
        const rootLevelKeys = allKeys.filter((key) => {
            const pathAfterPrefix = key.substring(processedPrefix.length);
            // If there's a slash in the remaining path, it's in a subdirectory
            return !pathAfterPrefix.includes('/');
        });

        this.logger.log(
            `Identified ${rootLevelKeys.length} root-level files to potentially migrate`,
        );

        const errors: string[] = [];
        let migratedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        // Regex to parse: processed/filename---processed@<label_name>_1.webp
        // Captures: filename and label name
        const filenamePattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;

        for (const key of rootLevelKeys) {
            try {
                // Parse the key to extract original filename and label name
                const match = key.match(filenamePattern);
                if (!match) {
                    const errorMsg = `Skipping malformed key (cannot parse): ${key}`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                const [, originalFilename, labelName] = match;

                // Verify label exists in database
                const label = await this.labelRepository.findOne({
                    where: { name: labelName },
                });

                if (!label) {
                    const errorMsg = `Skipping ${key}: label '${labelName}' not found in database`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                // Construct new key: processed/<label_name>/<filename>
                const filename = key.split('/').pop()!;
                const newKey = `processed/${labelName}/${filename}`;

                // Check if file already exists at new location (idempotency)
                const existingFilesAtNewLocation = await this.fileService.listObjects(
                    bucketName,
                    newKey,
                );
                if (existingFilesAtNewLocation.length > 0) {
                    this.logger.log(
                        `Skipping ${key}: already exists at new location ${newKey} (idempotent)`,
                    );
                    skippedCount++;
                    continue;
                }

                if (dryRun) {
                    this.logger.log(`[DRY RUN] Would migrate: ${key} -> ${newKey}`);
                    migratedCount++;
                    continue;
                }

                // Download the file
                const fileOutput = await this.fileService.downloadFile(bucketName, key);

                if (!fileOutput.Body) {
                    const errorMsg = `Failed to download file: ${key}`;
                    this.logger.error(errorMsg);
                    errors.push(errorMsg);
                    failedCount++;
                    continue;
                }

                // Convert stream to buffer
                const chunks: Buffer[] = [];
                for await (const chunk of fileOutput.Body as any) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                // Upload to new location
                await this.fileService.uploadFile(bucketName, newKey, buffer);
                this.logger.log(`Copied file from ${key} to ${newKey}`);

                // Update ProcessedImage record's key field
                const processedImage = await this.processedImageRepository.findOne({
                    where: { key },
                });

                if (processedImage) {
                    processedImage.key = newKey;
                    await this.processedImageRepository.save(processedImage);
                    this.logger.log(`Updated database record for ${key} to ${newKey}`);
                } else {
                    this.logger.warn(
                        `No database record found for ${key}, file copied but DB not updated`,
                    );
                }

                // Delete old file after successful copy and DB update
                await this.fileService.deleteFile(bucketName, key);
                this.logger.log(`Deleted old file: ${key}`);

                migratedCount++;
            } catch (error) {
                failedCount++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorMsg = `Failed to migrate ${key}: ${errorMessage}`;
                this.logger.error(errorMsg, error instanceof Error ? error.stack : undefined);
                errors.push(errorMsg);
            }
        }

        this.logger.log(
            `Migration complete${dryRun ? ' (DRY RUN)' : ''}: ${migratedCount} migrated, ${skippedCount} skipped, ${failedCount} failed`,
        );

        return new MigrationResultContract(migratedCount, skippedCount, failedCount, errors);
    }
}
