import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';
import { IFileService } from '../storage/types';
import { ProcessedImage } from '../database/entities/processed-image.entity';
import {
    CollectionReferenceContract,
    FakeProcessImagesResultContract,
    ProcessedImageContract,
    SyncProcessedImagesResultContract,
    UpdateProcessedImageHiddenContract,
    UpdateProcessedImageFlaggedContract,
    UpdateProcessedImageScoreContract,
} from './types';
import { PagedResult, SortMeta } from '../types';
import { Image } from '../database/entities/image.entity';
import { ScrapedImage } from '../database/entities/scraped-image.entity';
import { Label } from '../database/entities/label.entity';
import { ProcessingRun } from '../database/entities/processing-run.entity';
import * as path from 'path';

@Injectable()
export class ProcessedImagesService {
    constructor(
        @Inject(IFileService) private readonly fileService: IFileService,
        private readonly configService: AppConfigService,
        @InjectRepository(ProcessedImage)
        private readonly processedImageRepository: Repository<ProcessedImage>,
        @InjectRepository(Image)
        private readonly imageRepository: Repository<Image>,
        @InjectRepository(ScrapedImage)
        private readonly scrapedImageRepository: Repository<ScrapedImage>,
        @InjectRepository(Label)
        private readonly labelRepository: Repository<Label>,
        @InjectRepository(ProcessingRun)
        private readonly processingRunRepository: Repository<ProcessingRun>,
        private readonly logger: Logger,
    ) {}

    async fakeProcessImages(labelName: string): Promise<FakeProcessImagesResultContract> {
        const errors: string[] = [];
        let processedCount = 0;

        try {
            const bucketName = this.configService.assetsBucketName;
            const storedPrefix = 'stored';
            const processedPrefix = 'processed';

            // Get all images from the stored folder
            const storedKeys = await this.fileService.listObjects(bucketName, storedPrefix);

            if (storedKeys.length === 0) {
                return new FakeProcessImagesResultContract(0, ['No images found in stored folder']);
            }

            // Process each image
            for (const key of storedKeys) {
                try {
                    // Download the file
                    const fileOutput = await this.fileService.downloadFile(bucketName, key);

                    if (!fileOutput.Body) {
                        errors.push(`Failed to download file: ${key}`);
                        continue;
                    }

                    // Convert stream to buffer
                    const chunks: Buffer[] = [];
                    for await (const chunk of fileOutput.Body as any) {
                        chunks.push(chunk);
                    }
                    const buffer = Buffer.concat(chunks);

                    // Extract filename from key (stored/filename.ext)
                    const originalFilename = path.basename(key);

                    // Create new filename with pattern: <filename>---processed@<labelname>_<incremental_number>.webp
                    const newFilename = `${originalFilename}---processed@${labelName}_${processedCount + 1}.webp`;
                    // Store in label-specific folder: processed/<label_name>/<filename>
                    const newKey = `${processedPrefix}/${labelName}/${newFilename}`;

                    // Upload to processed folder
                    await this.fileService.uploadFile(bucketName, newKey, buffer);
                    processedCount++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Failed to process ${key}: ${errorMessage}`);
                }
            }

            return new FakeProcessImagesResultContract(processedCount, errors);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Fatal error: ${errorMessage}`);
            return new FakeProcessImagesResultContract(processedCount, errors);
        }
    }

    async getProcessedImages(
        processingRunId?: string,
        take?: number,
        skip?: number,
        sort?: SortMeta,
        hidden?: boolean,
        flagged?: boolean,
        minimalScore?: number,
        labelIds?: string[],
    ): Promise<PagedResult<ProcessedImageContract>> {
        const queryBuilder = this.processedImageRepository
            .createQueryBuilder('processedImage')
            .leftJoinAndSelect('processedImage.processingRun', 'processingRun')
            .leftJoinAndSelect('processingRun.collection', 'collection')
            .leftJoinAndSelect('processingRun.label', 'label')
            .leftJoinAndSelect('processedImage.sourceImage', 'sourceImage');

        // Track if we've added a WHERE clause yet
        let hasWhereClause = false;

        // Apply processing run filter
        if (processingRunId !== undefined) {
            queryBuilder.where('processingRun.id = :processingRunId', {
                processingRunId,
            });
            hasWhereClause = true;
        }

        // Apply hidden filter
        if (hidden !== undefined) {
            if (hasWhereClause) {
                queryBuilder.andWhere('processedImage.hidden = :hidden', { hidden });
            } else {
                queryBuilder.where('processedImage.hidden = :hidden', { hidden });
                hasWhereClause = true;
            }
        }

        // Apply flagged filter
        if (flagged !== undefined) {
            if (hasWhereClause) {
                queryBuilder.andWhere('processedImage.flagged = :flagged', { flagged });
            } else {
                queryBuilder.where('processedImage.flagged = :flagged', { flagged });
                hasWhereClause = true;
            }
        }

        // Apply minimalScore filter
        if (minimalScore !== undefined) {
            if (hasWhereClause) {
                queryBuilder.andWhere('processedImage.score >= :minimalScore', { minimalScore });
            } else {
                queryBuilder.where('processedImage.score >= :minimalScore', { minimalScore });
                hasWhereClause = true;
            }
        }

        // Apply labelIds filter
        if (labelIds !== undefined && labelIds.length > 0) {
            if (hasWhereClause) {
                queryBuilder.andWhere('label.id IN (:...labelIds)', { labelIds });
            } else {
                queryBuilder.where('label.id IN (:...labelIds)', { labelIds });
                hasWhereClause = true;
            }
        }

        // Apply sorting
        if (sort) {
            const sortOrder = sort.order === 1 ? 'ASC' : 'DESC';
            queryBuilder.orderBy(`processedImage.${sort.field}`, sortOrder);
        } else {
            queryBuilder
                .orderBy('processingRun.id', 'ASC')
                .addOrderBy('processedImage.filename', 'ASC');
        }

        // Apply pagination
        if (take !== undefined) {
            queryBuilder.take(take);
        }
        if (skip !== undefined) {
            queryBuilder.skip(skip);
        }

        const [processedImages, count] = await queryBuilder.getManyAndCount();

        // Generate presigned URLs for each image
        const expirationSeconds = 3600; // 1 hour
        const results = await Promise.all(
            processedImages.map(async (image) => {
                const url = await this.fileService.getGetObjectSignedUrl(
                    image.bucket,
                    image.key,
                    expirationSeconds,
                );

                // Extract collection from processing run
                const collections = image.processingRun?.collection
                    ? [
                          new CollectionReferenceContract(
                              image.processingRun.collection.id,
                              image.processingRun.collection.url,
                          ),
                      ]
                    : undefined;

                return new ProcessedImageContract(image, url, collections);
            }),
        );

        return new PagedResult(results, count);
    }

    async getProcessedImageById(id: string): Promise<ProcessedImageContract> {
        const processedImage = await this.processedImageRepository.findOne({
            where: { id },
            relations: ['processingRun', 'processingRun.collection', 'sourceImage'],
        });

        if (!processedImage) {
            throw new NotFoundException(`Processed image with id '${id}' not found`);
        }

        // Generate presigned URL
        const expirationSeconds = 3600; // 1 hour
        const url = await this.fileService.getGetObjectSignedUrl(
            processedImage.bucket,
            processedImage.key,
            expirationSeconds,
        );

        // Extract collection from processing run
        const collections = processedImage.processingRun?.collection
            ? [
                  new CollectionReferenceContract(
                      processedImage.processingRun.collection.id,
                      processedImage.processingRun.collection.url,
                  ),
              ]
            : undefined;

        return new ProcessedImageContract(processedImage, url, collections);
    }

    async updateProcessedImageHidden(
        id: string,
        contract: UpdateProcessedImageHiddenContract,
    ): Promise<ProcessedImageContract> {
        const processedImage = await this.processedImageRepository.findOne({
            where: { id },
        });

        if (!processedImage) {
            throw new NotFoundException(`Processed image with id '${id}' not found`);
        }

        processedImage.hidden = contract.hidden;
        await this.processedImageRepository.save(processedImage);

        // Generate presigned URL for the updated image
        const expirationSeconds = 3600; // 1 hour
        const url = await this.fileService.getGetObjectSignedUrl(
            processedImage.bucket,
            processedImage.key,
            expirationSeconds,
        );

        return new ProcessedImageContract(processedImage, url);
    }

    async updateProcessedImageFlagged(
        id: string,
        contract: UpdateProcessedImageFlaggedContract,
    ): Promise<ProcessedImageContract> {
        const processedImage = await this.processedImageRepository.findOne({
            where: { id },
        });

        if (!processedImage) {
            throw new NotFoundException(`Processed image with id '${id}' not found`);
        }

        processedImage.flagged = contract.flagged;
        await this.processedImageRepository.save(processedImage);

        // Generate presigned URL for the updated image
        const expirationSeconds = 3600; // 1 hour
        const url = await this.fileService.getGetObjectSignedUrl(
            processedImage.bucket,
            processedImage.key,
            expirationSeconds,
        );

        return new ProcessedImageContract(processedImage, url);
    }

    async updateProcessedImageScore(
        id: string,
        contract: UpdateProcessedImageScoreContract,
    ): Promise<ProcessedImageContract> {
        const processedImage = await this.processedImageRepository.findOne({
            where: { id },
        });

        if (!processedImage) {
            throw new NotFoundException(`Processed image with id '${id}' not found`);
        }

        processedImage.score = contract.score;
        await this.processedImageRepository.save(processedImage);

        // Generate presigned URL for the updated image
        const expirationSeconds = 3600; // 1 hour
        const url = await this.fileService.getGetObjectSignedUrl(
            processedImage.bucket,
            processedImage.key,
            expirationSeconds,
        );

        return new ProcessedImageContract(processedImage, url);
    }

    async syncProcessedImagesByLabel(labelId: string): Promise<SyncProcessedImagesResultContract> {
        // Fetch label from database to get label name
        const label = await this.labelRepository.findOne({
            where: { id: labelId },
        });

        if (!label) {
            throw new NotFoundException(`Label with id '${labelId}' not found`);
        }

        const bucketName = this.configService.assetsBucketName;
        const prefix = `processed/${label.name}/`;

        this.logger.log(`Starting sync of processed images for label '${label.name}' from storage`);

        // Scan S3 at path /processed/<label_name>/
        let keys = await this.fileService.listObjects(bucketName, prefix);
        this.logger.log(`Found ${keys.length} processed files in storage for label '${label.name}'`);

        // Also check for old-format images in the root processed/ folder that match this label
        const oldFormatPrefix = 'processed/';
        const allProcessedKeys = await this.fileService.listObjects(bucketName, oldFormatPrefix);
        
        // Filter for old-format keys (no subdirectory) that match this label
        const oldFormatPattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;
        const oldFormatKeys = allProcessedKeys.filter(key => {
            const match = key.match(oldFormatPattern);
            if (!match) return false;
            const [, , labelName] = match;
            return labelName === label.name;
        });

        if (oldFormatKeys.length > 0) {
            this.logger.log(`Found ${oldFormatKeys.length} old-format images for label '${label.name}' that need migration`);
            keys = [...keys, ...oldFormatKeys];
        }

        const errors: string[] = [];
        let processedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let migratedCount = 0;

        // Regex to parse new format: processed/<label_name>/filename---processed@<label_name>_1.webp
        const newFormatPattern = /^processed\/[^/]+\/(.+?)---processed@(.+?)_\d+\.webp$/;
        // Regex to parse old format: processed/filename---processed@<label_name>_1.webp
        const oldFormatPatternFull = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;

        for (const key of keys) {
            try {
                let originalFilename: string;
                let labelName: string;
                let isOldFormat = false;
                let newKey = key;

                // Try to match new format first
                let match = key.match(newFormatPattern);
                if (match) {
                    [, originalFilename, labelName] = match;
                } else {
                    // Try old format
                    match = key.match(oldFormatPatternFull);
                    if (match) {
                        [, originalFilename, labelName] = match;
                        isOldFormat = true;
                        // Calculate new key for migration
                        const filename = key.split('/').pop()!;
                        newKey = `processed/${label.name}/${filename}`;
                    } else {
                        const errorMsg = `Skipping malformed key: ${key}`;
                        this.logger.warn(errorMsg);
                        errors.push(errorMsg);
                        skippedCount++;
                        continue;
                    }
                }

                // Verify the label name in the filename matches the label we're syncing
                if (labelName !== label.name) {
                    const errorMsg = `Skipping ${key}: label name in filename '${labelName}' does not match expected label '${label.name}'`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                // Find source Image by filename
                const sourceImage = await this.imageRepository.findOne({
                    where: { filename: originalFilename },
                });

                if (!sourceImage) {
                    const errorMsg = `Skipping ${key}: source image with filename '${originalFilename}' not found`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                // Find ScrapedImage to get collection
                const scrapedImage = await this.scrapedImageRepository.findOne({
                    where: { image: { id: sourceImage.id } },
                    relations: ['scrape', 'scrape.collection'],
                });

                if (!scrapedImage || !scrapedImage.scrape) {
                    const errorMsg = `Skipping ${key}: scraped image not found for source image '${originalFilename}'`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                const collection = scrapedImage.scrape.collection;

                // Find or create ProcessingRun for this collection-label pair
                let processingRun = await this.processingRunRepository.findOne({
                    where: {
                        collection: { id: collection.id },
                        label: { id: label.id },
                    },
                });

                if (!processingRun) {
                    processingRun = this.processingRunRepository.create({
                        collection,
                        label,
                    });
                    processingRun = await this.processingRunRepository.save(processingRun);
                    this.logger.log(
                        `Created new processing run for collection '${collection.id}' and label '${label.name}'`,
                    );
                }

                // If this is an old-format image, migrate it
                if (isOldFormat) {
                    try {
                        // Download the file
                        const fileOutput = await this.fileService.downloadFile(bucketName, key);
                        
                        if (!fileOutput.Body) {
                            throw new Error('Failed to download file for migration');
                        }

                        // Convert stream to buffer
                        const chunks: Buffer[] = [];
                        for await (const chunk of fileOutput.Body as any) {
                            chunks.push(chunk);
                        }
                        const buffer = Buffer.concat(chunks);

                        // Upload to new location
                        await this.fileService.uploadFile(bucketName, newKey, buffer);
                        this.logger.log(`Migrated ${key} to ${newKey}`);

                        // Delete old file
                        await this.fileService.deleteFile(bucketName, key);
                        this.logger.log(`Deleted old file: ${key}`);

                        migratedCount++;
                    } catch (migrationError) {
                        const errorMessage = migrationError instanceof Error ? migrationError.message : String(migrationError);
                        const errorMsg = `Failed to migrate ${key}: ${errorMessage}`;
                        this.logger.error(errorMsg, migrationError instanceof Error ? migrationError.stack : undefined);
                        errors.push(errorMsg);
                        // Continue with old key if migration fails
                        newKey = key;
                    }
                }

                // Check if ProcessedImage already exists with the old or new key
                let processedImage = await this.processedImageRepository.findOne({
                    where: [{ key: newKey }, { key }],
                });

                if (processedImage) {
                    // Update existing processed image with new key
                    processedImage.filename = newKey.split('/').pop()!;
                    processedImage.bucket = bucketName;
                    processedImage.key = newKey;
                    processedImage.processingRun = processingRun;
                    processedImage.sourceImage = sourceImage;
                    await this.processedImageRepository.save(processedImage);
                    this.logger.log(`Updated existing processed image: ${newKey}`);
                } else {
                    // Create new processed image
                    processedImage = this.processedImageRepository.create({
                        filename: newKey.split('/').pop()!,
                        bucket: bucketName,
                        key: newKey,
                        processingRun,
                        sourceImage,
                    });
                    await this.processedImageRepository.save(processedImage);
                    this.logger.log(`Created new processed image: ${newKey}`);
                }

                processedCount++;
            } catch (error) {
                failedCount++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorMsg = `Failed to process ${key}: ${errorMessage}`;
                this.logger.error(errorMsg, error instanceof Error ? error.stack : undefined);
                errors.push(errorMsg);
            }
        }

        const logMessage = migratedCount > 0
            ? `Sync complete for label '${label.name}': ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed, ${migratedCount} migrated`
            : `Sync complete for label '${label.name}': ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed`;
        
        this.logger.log(logMessage);

        return new SyncProcessedImagesResultContract(
            processedCount,
            skippedCount,
            failedCount,
            errors,
        );
    }

    /**
     * @deprecated Use syncProcessedImagesByLabel instead. This method will be removed in a future version.
     */
    async syncProcessedImagesFromStorage(): Promise<SyncProcessedImagesResultContract> {
        const bucketName = this.configService.assetsBucketName;
        const prefix = 'processed/';

        this.logger.log('Starting sync of processed images from storage');

        // List all processed files from storage
        const keys = await this.fileService.listObjects(bucketName, prefix);
        this.logger.log(`Found ${keys.length} processed files in storage`);

        const errors: string[] = [];
        let processedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        // Regex to parse: processed/66442730_013_c291.jpg---processed@HR_1.webp
        // Captures: filename and label name
        const filenamePattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;

        for (const key of keys) {
            try {
                // Parse the key to extract original filename and label name
                const match = key.match(filenamePattern);
                if (!match) {
                    const errorMsg = `Skipping malformed key: ${key}`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                const [, originalFilename, labelName] = match;

                // Find source Image by filename
                const sourceImage = await this.imageRepository.findOne({
                    where: { filename: originalFilename },
                });

                if (!sourceImage) {
                    const errorMsg = `Skipping ${key}: source image with filename '${originalFilename}' not found`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                // Find ScrapedImage to get collection
                const scrapedImage = await this.scrapedImageRepository.findOne({
                    where: { image: { id: sourceImage.id } },
                    relations: ['scrape', 'scrape.collection'],
                });

                if (!scrapedImage || !scrapedImage.scrape) {
                    const errorMsg = `Skipping ${key}: scraped image not found for source image '${originalFilename}'`;
                    this.logger.warn(errorMsg);
                    errors.push(errorMsg);
                    skippedCount++;
                    continue;
                }

                const collection = scrapedImage.scrape.collection;

                // Find Label by name (do NOT create if not exists)
                const label = await this.labelRepository.findOne({
                    where: { name: labelName },
                });

                if (!label) {
                    throw new NotFoundException(
                        `Label with name '${labelName}' not found. Please create the label before syncing processed images.`,
                    );
                }

                // Find or create ProcessingRun for this collection-label pair
                let processingRun = await this.processingRunRepository.findOne({
                    where: {
                        collection: { id: collection.id },
                        label: { id: label.id },
                    },
                });

                if (!processingRun) {
                    processingRun = this.processingRunRepository.create({
                        collection,
                        label,
                    });
                    processingRun = await this.processingRunRepository.save(processingRun);
                    this.logger.log(
                        `Created new processing run for collection '${collection.id}' and label '${labelName}'`,
                    );
                }

                // Check if ProcessedImage already exists with this key
                let processedImage = await this.processedImageRepository.findOne({
                    where: { key },
                });

                if (processedImage) {
                    // Update existing processed image
                    processedImage.filename = key.split('/').pop()!;
                    processedImage.bucket = bucketName;
                    processedImage.processingRun = processingRun;
                    processedImage.sourceImage = sourceImage;
                    await this.processedImageRepository.save(processedImage);
                    this.logger.log(`Updated existing processed image: ${key}`);
                } else {
                    // Create new processed image
                    processedImage = this.processedImageRepository.create({
                        filename: key.split('/').pop()!,
                        bucket: bucketName,
                        key,
                        processingRun,
                        sourceImage,
                    });
                    await this.processedImageRepository.save(processedImage);
                    this.logger.log(`Created new processed image: ${key}`);
                }

                processedCount++;
            } catch (error) {
                failedCount++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorMsg = `Failed to process ${key}: ${errorMessage}`;
                this.logger.error(errorMsg, error instanceof Error ? error.stack : undefined);
                errors.push(errorMsg);
            }
        }

        this.logger.log(
            `Sync complete: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed`,
        );

        return new SyncProcessedImagesResultContract(
            processedCount,
            skippedCount,
            failedCount,
            errors,
        );
    }
}
