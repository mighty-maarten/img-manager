import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { Collection } from 'src/database/entities/collection.entity';
import { Label } from 'src/database/entities/label.entity';
import { ScrapedImage } from 'src/database/entities/scraped-image.entity';
import { Scrape } from 'src/database/entities/scrape.entity';
import { Image } from 'src/database/entities/image.entity';
import { ProcessedImage } from 'src/database/entities/processed-image.entity';
import {
    CollectionContract,
    CollectionDownloadUrlContract,
    CollectionDownloadUrlsContract,
    CreateCollectionsContract,
    CreateCollectionsResultContract,
    ProcessedFilter,
    ScrapeCollectionContract,
    UpdateCollectionContract,
} from './types';
import { ScrapingService } from '../scraping/scraping.service';
import { ScrapeResultContract } from '../scraping/types';
import { IFileService } from '../storage/types';
import { AppConfigService } from '../config/app-config.service';
import { PagedResult, SortMeta } from '../types';

@Injectable()
export class CollectionsService {
    constructor(
        @InjectRepository(Collection)
        private collectionRepository: Repository<Collection>,
        @InjectRepository(Label)
        private labelRepository: Repository<Label>,
        @InjectRepository(ScrapedImage)
        private scrapedImageRepository: Repository<ScrapedImage>,
        @InjectRepository(Scrape)
        private scrapeRepository: Repository<Scrape>,
        @InjectRepository(Image)
        private imageRepository: Repository<Image>,
        @InjectRepository(ProcessedImage)
        private processedImageRepository: Repository<ProcessedImage>,
        private scrapingService: ScrapingService,
        @Inject(IFileService)
        private fileService: IFileService,
        private configService: AppConfigService,
        private logger: Logger,
    ) {}

    public async getCollections(
        take?: number,
        skip?: number,
        sort?: SortMeta,
        scraped?: boolean,
        stored?: boolean,
        processed?: ProcessedFilter,
        labelIds?: string[],
    ): Promise<PagedResult<CollectionContract>> {
        const queryBuilder = this.collectionRepository
            .createQueryBuilder('collection')
            .leftJoinAndSelect('collection.labels', 'labels')
            .leftJoinAndSelect('collection.scrape', 'scrape')
            .leftJoinAndSelect('collection.processingRuns', 'processingRuns')
            .leftJoinAndSelect('processingRuns.label', 'processingRunLabel');

        // Apply scraped filter
        if (scraped !== undefined) {
            if (scraped) {
                queryBuilder.andWhere('scrape.id IS NOT NULL');
            } else {
                queryBuilder.andWhere('scrape.id IS NULL');
            }
        }

        // Apply stored filter
        if (stored !== undefined) {
            if (stored) {
                queryBuilder.andWhere('scrape.id IS NOT NULL');
                queryBuilder.andWhere('scrape.stored = :stored', { stored: true });
            } else {
                queryBuilder.andWhere('scrape.id IS NOT NULL');
                queryBuilder.andWhere('scrape.stored = :stored', { stored: false });
            }
        }
        
        if (processed !== undefined) {
            const labelCountSubquery = `(SELECT COUNT(*) FROM collections_labels cl WHERE cl.collection_id = collection.id)`;
            const runCountSubquery = `(SELECT COUNT(*) FROM processing_runs pr WHERE pr.collection_id = collection.id)`;

            if (processed === ProcessedFilter.ALL) {
                // All labels have processing runs (and has at least one label)
                queryBuilder.andWhere(`${labelCountSubquery} > 0`);
                queryBuilder.andWhere(`${labelCountSubquery} = ${runCountSubquery}`);
            } else if (processed === ProcessedFilter.NONE) {
                // No processing runs at all
                queryBuilder.andWhere(`${runCountSubquery} = 0`);
            } else if (processed === ProcessedFilter.PARTIAL) {
                // Some but not all labels have processing runs
                queryBuilder.andWhere(`${runCountSubquery} > 0`);
                queryBuilder.andWhere(`${labelCountSubquery} > ${runCountSubquery}`);
            }
        }

        // Apply label filter
        if (labelIds && labelIds.length > 0) {
            queryBuilder.andWhere('labels.id IN (:...labelIds)', { labelIds });
        }

        // Apply sorting
        if (sort) {
            const sortOrder = sort.order === 1 ? 'ASC' : 'DESC';
            // Check if field already contains a table/alias prefix (e.g., "scrape.title")
            const sortField = sort.field.includes('.') ? sort.field : `collection.${sort.field}`;
            queryBuilder.orderBy(sortField, sortOrder);
        } else {
            queryBuilder.orderBy('collection.createdOn', 'DESC');
        }

        // Apply pagination
        if (take !== undefined) {
            queryBuilder.take(take);
        }
        if (skip !== undefined) {
            queryBuilder.skip(skip);
        }

        const [collections, count] = await queryBuilder.getManyAndCount();

        const results = collections.map((collection) => new CollectionContract(collection));
        return new PagedResult(results, count);
    }

    public async getCollection(collectionId: string): Promise<CollectionContract> {
        const collection = await this.collectionRepository.findOne({
            where: { id: collectionId },
            relations: ['labels', 'scrape', 'processingRuns', 'processingRuns.label'],
        });
        if (collection) {
            return new CollectionContract(collection);
        } else {
            throw CollectionsService.getCollectionNotFoundException(collectionId);
        }
    }

    public async createCollections(
        createCollectionsContract: CreateCollectionsContract,
    ): Promise<CreateCollectionsResultContract> {
        // Validate labels once for all collections
        const labels = await this.validateAndGetLabels(createCollectionsContract.labelIds);

        // Check for duplicate URLs in the request
        const uniqueUrls = new Set<string>();
        const duplicatesInRequest = new Set<string>();
        for (const url of createCollectionsContract.urls) {
            if (uniqueUrls.has(url)) {
                duplicatesInRequest.add(url);
            } else {
                uniqueUrls.add(url);
            }
        }

        // Query for existing collections with these URLs
        const existingCollections = await this.collectionRepository.find({
            where: { url: In(Array.from(uniqueUrls)) },
            relations: ['labels'],
        });

        const existingUrls = new Set(existingCollections.map((c) => c.url));
        const existingCollectionsByUrl = new Map(existingCollections.map((c) => [c.url, c]));

        // Track results
        const created: CollectionContract[] = [];
        const failed: Record<string, string> = {};

        // Process each unique URL
        for (const url of uniqueUrls) {
            try {
                // Check if URL is duplicate in request
                if (duplicatesInRequest.has(url)) {
                    failed[url] = 'Duplicate URL in request';
                    continue;
                }

                // Check if collection already exists
                if (existingUrls.has(url)) {
                    const existingCollection = existingCollectionsByUrl.get(url)!;
                    const existingLabelIds = new Set(existingCollection.labels.map((l) => l.id));
                    const requestedLabelIds = labels.map((l) => l.id);

                    // Check if there are any new labels to add
                    const newLabels = requestedLabelIds.filter((id) => !existingLabelIds.has(id));

                    if (newLabels.length > 0) {
                        // Merge labels: keep existing + add new ones
                        existingCollection.labels = [
                            ...existingCollection.labels,
                            ...labels.filter((l) => newLabels.includes(l.id)),
                        ];
                        await this.collectionRepository.save(existingCollection);
                        const updatedCollectionContract = await this.getCollection(
                            existingCollection.id,
                        );
                        created.push(updatedCollectionContract);
                        this.logger.log(
                            `Updated collection ${existingCollection.id} with ${newLabels.length} new label(s)`,
                        );
                    } else {
                        failed[url] = 'Collection already exists with the same labels';
                    }
                    continue;
                }

                // Create collection
                const collection = this.collectionRepository.create({
                    url,
                    labels,
                });

                const savedCollection = await this.collectionRepository.save(collection);
                const collectionContract = await this.getCollection(savedCollection.id);
                created.push(collectionContract);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                failed[url] = errorMessage;
                this.logger.error(`Failed to create collection for URL ${url}: ${errorMessage}`);
            }
        }

        return new CreateCollectionsResultContract(created, failed);
    }

    public async updateCollection(
        collectionId: string,
        updateCollectionContract: UpdateCollectionContract,
    ): Promise<CollectionContract> {
        const collection = await this.collectionRepository.findOne({
            where: { id: collectionId },
            relations: ['labels'],
        });

        if (!collection) {
            throw CollectionsService.getCollectionNotFoundException(collectionId);
        }

        if (updateCollectionContract.url) {
            const existingCollection = await this.collectionRepository.findOne({
                where: { url: updateCollectionContract.url },
            });

            if (existingCollection && existingCollection.id !== collectionId) {
                throw new ConflictException(
                    `Collection with URL '${updateCollectionContract.url}' already exists`,
                );
            }

            collection.url = updateCollectionContract.url;
        }

        if (updateCollectionContract.labelIds !== undefined) {
            collection.labels = await this.validateAndGetLabels(updateCollectionContract.labelIds);
        }

        await this.collectionRepository.save(collection);

        return this.getCollection(collectionId);
    }

    public async deleteCollection(collectionId: string): Promise<void> {
        const collection = await this.collectionRepository.findOne({
            where: { id: collectionId },
        });

        if (!collection) {
            throw CollectionsService.getCollectionNotFoundException(collectionId);
        }

        // Get all images referenced by this collection's scraped images before deletion
        const imageIdsToCheck: string[] = [];
        const scrape = await this.scrapeRepository.findOne({
            where: { collection: { id: collectionId } },
            relations: ['scrapedImages', 'scrapedImages.image'],
        });

        if (scrape) {
            for (const scrapedImage of scrape.scrapedImages) {
                if (scrapedImage.image) {
                    imageIdsToCheck.push(scrapedImage.image.id);
                }
            }
        }

        // Delete the collection (cascade will delete scrape and scraped images)
        await this.collectionRepository.remove(collection);

        // Check and delete orphaned images
        if (imageIdsToCheck.length > 0) {
            await this.deleteOrphanedImages(imageIdsToCheck);
        }
    }

    public async scrapeCollection(
        collectionId: string,
        scrapeConfig: ScrapeCollectionContract,
    ): Promise<ScrapeResultContract> {
        const collection = await this.collectionRepository.findOne({
            where: { id: collectionId },
        });

        if (!collection) {
            throw CollectionsService.getCollectionNotFoundException(collectionId);
        }

        // Delete existing scrape for this collection (will cascade delete scraped images)
        const existingScrape = await this.scrapeRepository.findOne({
            where: { collection: { id: collectionId } },
        });

        if (existingScrape) {
            await this.scrapeRepository.remove(existingScrape);
        }

        const scrapeResult = await this.scrapingService.scrapeImages({
            urls: [collection.url],
            sizePreset: scrapeConfig.sizePreset,
            scrapingMode: scrapeConfig.scrapingMode,
        });

        // Create a Scrape record
        const scrape = this.scrapeRepository.create({
            sizePreset: scrapeConfig.sizePreset,
            scrapingMode: scrapeConfig.scrapingMode,
            errors: scrapeResult.errors.map((error) => `${error.url}|${error.error}`),
            tags: scrapeResult.tags || [],
            categories: scrapeResult.categories || [],
            models: scrapeResult.models || [],
            title: scrapeResult.title || 'Unknown',
            collection: collection,
        });

        const savedScrape = await this.scrapeRepository.save(scrape);

        // Save scraped images to database
        const scrapedImages = scrapeResult.images.map((imageMetadata) =>
            this.scrapedImageRepository.create({
                filename: imageMetadata.filename,
                url: imageMetadata.url,
                sourceUrl: imageMetadata.sourceUrl,
                width: imageMetadata.width,
                height: imageMetadata.height,
                fileSize: imageMetadata.fileSize,
                format: imageMetadata.format,
                scrape: savedScrape,
                storedOn: undefined,
            }),
        );

        await this.scrapedImageRepository.save(scrapedImages);

        return scrapeResult;
    }

    public async getScrapeResult(
        collectionId: string,
        scrapeId: string,
    ): Promise<ScrapeResultContract> {
        const scrape = await this.scrapeRepository.findOne({
            where: { id: scrapeId },
            relations: ['collection', 'scrapedImages', 'scrapedImages.image'],
        });

        if (!scrape) {
            throw new NotFoundException(`Scrape with id '${scrapeId}' was not found`);
        }

        if (scrape.collection.id !== collectionId) {
            throw new BadRequestException(
                `Scrape with id '${scrapeId}' does not belong to collection '${collectionId}'`,
            );
        }

        // Parse errors from stored format "url|error" back to objects
        const errors = scrape.errors.map((errorStr) => {
            const [url, error] = errorStr.split('|');
            return { url, error };
        });

        // Transform scraped images to ImageMetadataContract format
        const images = await Promise.all(
            scrape.scrapedImages.map(async (scrapedImage) => ({
                id: scrapedImage.id,
                filename: scrapedImage.filename,
                url: scrapedImage.image
                    ? await this.fileService.getGetObjectSignedUrl(
                          scrapedImage.image.bucket,
                          scrapedImage.image.key,
                          3600,
                      )
                    : scrapedImage.url,
                sourceUrl: scrapedImage.sourceUrl,
                width: scrapedImage.width,
                height: scrapedImage.height,
                fileSize: scrapedImage.fileSize,
                format: scrapedImage.format,
            })),
        );

        return {
            images,
            scrapeMode: scrape.scrapingMode,
            tags: scrape.tags,
            categories: scrape.categories,
            models: scrape.models,
            title: scrape.title,
            errors,
        };
    }

    public async storeScrape(
        collectionId: string,
        scrapeId: string,
    ): Promise<{ stored: number; failed: number; errors: string[] }> {
        const scrape = await this.scrapeRepository.findOne({
            where: { id: scrapeId },
            relations: ['collection', 'scrapedImages'],
        });

        if (!scrape) {
            throw new NotFoundException(`Scrape with id '${scrapeId}' was not found`);
        }

        if (scrape.collection.id !== collectionId) {
            throw new BadRequestException(
                `Scrape with id '${scrapeId}' does not belong to collection '${collectionId}'`,
            );
        }

        const bucketName = this.configService.assetsBucketName;
        const errors: string[] = [];
        let storedCount = 0;
        let failedCount = 0;

        // Store each scraped image
        for (const scrapedImage of scrape.scrapedImages) {
            try {
                this.logger.log(`Storing image from ${scrapedImage.url}`);

                // Download the image
                const response = await axios.get(scrapedImage.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                });

                const imageBuffer = Buffer.from(response.data);

                // Generate hash for the image
                const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

                // Check if image with this hash already exists
                let image = await this.imageRepository.findOne({ where: { hash } });

                if (!image) {
                    const key = `stored/${scrapedImage.filename}`;

                    // Upload to storage (S3 or local)
                    await this.fileService.uploadFile(bucketName, key, imageBuffer);

                    // Create Image record
                    image = this.imageRepository.create({
                        hash,
                        filename: scrapedImage.filename,
                        url: scrapedImage.sourceUrl,
                        bucket: bucketName,
                        key,
                    });

                    await this.imageRepository.save(image);
                    this.logger.log(`Created new image record with hash ${hash}`);
                } else {
                    this.logger.log(`Image with hash ${hash} already exists, reusing`);
                }

                // Update ScrapedImage with reference to Image and store timestamp
                scrapedImage.image = image;
                scrapedImage.storedOn = new Date();
                await this.scrapedImageRepository.save(scrapedImage);

                storedCount++;
            } catch (error) {
                failedCount++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(
                    `Failed to store image ${scrapedImage.url}: ${errorMessage}`,
                    error instanceof Error ? error.stack : undefined,
                );
                errors.push(`${scrapedImage.url}: ${errorMessage}`);
            }
        }

        // Mark scrape as stored
        scrape.stored = true;
        await this.scrapeRepository.save(scrape);

        this.logger.log(
            `Store complete for scrape ${scrapeId}: ${storedCount} succeeded, ${failedCount} failed`,
        );

        return {
            stored: storedCount,
            failed: failedCount,
            errors,
        };
    }

    public async getCollectionDownloadUrls(
        collectionId: string,
    ): Promise<CollectionDownloadUrlsContract> {
        const collection = await this.collectionRepository.findOne({
            where: { id: collectionId },
        });

        if (!collection) {
            throw CollectionsService.getCollectionNotFoundException(collectionId);
        }

        // Get the scrape for this collection
        const scrape = await this.scrapeRepository.findOne({
            where: { collection: { id: collectionId } },
            relations: ['scrapedImages', 'scrapedImages.image'],
        });

        if (!scrape) {
            throw new NotFoundException(
                `Collection with id '${collectionId}' has not been scraped yet`,
            );
        }

        if (!scrape.stored) {
            throw new BadRequestException(
                `Collection with id '${collectionId}' has not been stored yet`,
            );
        }

        // Filter for stored images (those with storedOn timestamp and image reference)
        const storedImages = scrape.scrapedImages.filter(
            (scrapedImage) => scrapedImage.storedOn && scrapedImage.image,
        );

        if (storedImages.length === 0) {
            return new CollectionDownloadUrlsContract([]);
        }

        // Generate presigned URLs for each image
        const expirationSeconds = 3600; // 1 hour
        const downloads: CollectionDownloadUrlContract[] = [];

        for (const scrapedImage of storedImages) {
            const image = scrapedImage.image!;
            const downloadUrl = await this.fileService.getGetObjectSignedUrl(
                image.bucket,
                image.key,
                expirationSeconds,
            );

            const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

            downloads.push(
                new CollectionDownloadUrlContract(image.id, image.filename, downloadUrl, expiresAt),
            );
        }

        return new CollectionDownloadUrlsContract(downloads);
    }

    private async validateAndGetLabels(labelIds?: string[]): Promise<Label[]> {
        if (!labelIds || labelIds.length === 0) {
            return [];
        }

        const labels = await this.labelRepository.find({
            where: { id: In(labelIds) },
        });

        if (labels.length !== labelIds.length) {
            const foundIds = labels.map((l) => l.id);
            const missingIds = labelIds.filter((id) => !foundIds.includes(id));
            throw new BadRequestException(
                `The following label IDs were not found: ${missingIds.join(', ')}`,
            );
        }

        return labels;
    }

    private async deleteOrphanedImages(imageIds: string[]): Promise<void> {
        for (const imageId of imageIds) {
            const isOrphaned = await this.isImageOrphaned(imageId);

            if (isOrphaned) {
                const image = await this.imageRepository.findOne({
                    where: { id: imageId },
                });

                if (image) {
                    // Delete the S3 file
                    try {
                        await this.fileService.deleteFile(image.bucket, image.key);
                        this.logger.log(
                            `Deleted S3 file for orphaned image: ${image.bucket}/${image.key}`,
                        );
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        this.logger.error(
                            `Failed to delete S3 file for image ${image.id}: ${errorMessage}`,
                            error instanceof Error ? error.stack : undefined,
                        );
                        // Continue with database cleanup even if S3 deletion fails
                    }

                    // Delete the image record
                    await this.imageRepository.remove(image);
                    this.logger.log(`Deleted orphaned image record: ${imageId}`);
                }
            }
        }
    }

    private async isImageOrphaned(imageId: string): Promise<boolean> {
        // Check if image is referenced by any collection
        const collectionCount = await this.imageRepository
            .createQueryBuilder('image')
            .innerJoin('image.collections', 'collection')
            .where('image.id = :imageId', { imageId })
            .getCount();

        if (collectionCount > 0) {
            return false;
        }

        // Check if image is referenced by any scraped image
        const scrapedImageCount = await this.scrapedImageRepository
            .createQueryBuilder('scraped_image')
            .where('scraped_image.image_id = :imageId', { imageId })
            .getCount();

        if (scrapedImageCount > 0) {
            return false;
        }

        // Check if image is referenced by any processed image as source
        const processedImageCount = await this.processedImageRepository
            .createQueryBuilder('processed_image')
            .where('processed_image.source_image_id = :imageId', { imageId })
            .getCount();

        return processedImageCount <= 0;
    }

    private static getCollectionNotFoundException(collectionId: string): NotFoundException {
        return new NotFoundException(`Collection with id '${collectionId}' was not found`);
    }
}
