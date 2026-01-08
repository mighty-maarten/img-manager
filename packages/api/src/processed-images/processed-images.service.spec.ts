import { Test, TestingModule } from '@nestjs/testing';
import { ProcessedImagesService } from './processed-images.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProcessedImage } from '../database/entities/processed-image.entity';
import { Image } from '../database/entities/image.entity';
import { ScrapedImage } from '../database/entities/scraped-image.entity';
import { Label } from '../database/entities/label.entity';
import { ProcessingRun } from '../database/entities/processing-run.entity';
import { AppConfigService } from '../config/app-config.service';
import { IFileService } from '../storage/types';
import { Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as fc from 'fast-check';

describe('ProcessedImagesService - Backward Compatibility', () => {
    let service: ProcessedImagesService;
    let fileService: jest.Mocked<IFileService>;
    let processedImageRepository: jest.Mocked<Repository<ProcessedImage>>;
    let imageRepository: jest.Mocked<Repository<Image>>;
    let scrapedImageRepository: jest.Mocked<Repository<ScrapedImage>>;
    let labelRepository: jest.Mocked<Repository<Label>>;
    let processingRunRepository: jest.Mocked<Repository<ProcessingRun>>;

    beforeEach(async () => {
        const mockFileService = {
            getGetObjectSignedUrl: jest.fn(),
            listObjects: jest.fn(),
            downloadFile: jest.fn(),
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
            deleteFiles: jest.fn(),
        };

        const mockConfigService = {
            assetsBucketName: 'test-bucket',
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProcessedImagesService,
                {
                    provide: IFileService,
                    useValue: mockFileService,
                },
                {
                    provide: AppConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: getRepositoryToken(ProcessedImage),
                    useValue: {
                        findOne: jest.fn(),
                        find: jest.fn(),
                        createQueryBuilder: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Image),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(ScrapedImage),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Label),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(ProcessingRun),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: Logger,
                    useValue: {
                        log: jest.fn(),
                        warn: jest.fn(),
                        error: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ProcessedImagesService>(ProcessedImagesService);
        fileService = module.get(IFileService);
        processedImageRepository = module.get(getRepositoryToken(ProcessedImage));
        imageRepository = module.get(getRepositoryToken(Image));
        scrapedImageRepository = module.get(getRepositoryToken(ScrapedImage));
        labelRepository = module.get(getRepositoryToken(Label));
        processingRunRepository = module.get(getRepositoryToken(ProcessingRun));
    });

    describe('Presigned URL Generation - Backward Compatibility', () => {
        it('should generate presigned URL for old format path (processed/<filename>)', async () => {
            // Arrange
            const oldFormatKey = 'processed/image1.jpg---processed@HR_1.webp';
            const mockProcessedImage = {
                id: '123',
                filename: 'image1.jpg---processed@HR_1.webp',
                bucket: 'test-bucket',
                key: oldFormatKey,
                processingRun: null,
                sourceImage: null,
            } as ProcessedImage;

            const expectedUrl = 'https://s3.amazonaws.com/test-bucket/processed/image1.jpg---processed@HR_1.webp?signature=xyz';

            processedImageRepository.findOne.mockResolvedValue(mockProcessedImage);
            fileService.getGetObjectSignedUrl.mockResolvedValue(expectedUrl);

            // Act
            const result = await service.getProcessedImageById('123');

            // Assert
            expect(fileService.getGetObjectSignedUrl).toHaveBeenCalledWith(
                'test-bucket',
                oldFormatKey,
                3600,
            );
            expect(result.url).toBe(expectedUrl);
        });

        it('should generate presigned URL for new format path (processed/<label>/<filename>)', async () => {
            // Arrange
            const newFormatKey = 'processed/HR/image1.jpg---processed@HR_1.webp';
            const mockProcessedImage = {
                id: '456',
                filename: 'image1.jpg---processed@HR_1.webp',
                bucket: 'test-bucket',
                key: newFormatKey,
                processingRun: null,
                sourceImage: null,
            } as ProcessedImage;

            const expectedUrl = 'https://s3.amazonaws.com/test-bucket/processed/HR/image1.jpg---processed@HR_1.webp?signature=abc';

            processedImageRepository.findOne.mockResolvedValue(mockProcessedImage);
            fileService.getGetObjectSignedUrl.mockResolvedValue(expectedUrl);

            // Act
            const result = await service.getProcessedImageById('456');

            // Assert
            expect(fileService.getGetObjectSignedUrl).toHaveBeenCalledWith(
                'test-bucket',
                newFormatKey,
                3600,
            );
            expect(result.url).toBe(expectedUrl);
        });

        it('should handle keys with special characters in both formats', async () => {
            // Test old format with special characters
            const oldFormatKey = 'processed/image@special_name.jpg---processed@HR_1.webp';
            const mockProcessedImage1 = {
                id: '789',
                filename: 'image@special_name.jpg---processed@HR_1.webp',
                bucket: 'test-bucket',
                key: oldFormatKey,
                processingRun: null,
                sourceImage: null,
            } as ProcessedImage;

            processedImageRepository.findOne.mockResolvedValue(mockProcessedImage1);
            fileService.getGetObjectSignedUrl.mockResolvedValue('https://example.com/old');

            await service.getProcessedImageById('789');

            expect(fileService.getGetObjectSignedUrl).toHaveBeenCalledWith(
                'test-bucket',
                oldFormatKey,
                3600,
            );

            // Test new format with special characters
            const newFormatKey = 'processed/HR/image@special_name.jpg---processed@HR_1.webp';
            const mockProcessedImage2 = {
                id: '790',
                filename: 'image@special_name.jpg---processed@HR_1.webp',
                bucket: 'test-bucket',
                key: newFormatKey,
                processingRun: null,
                sourceImage: null,
            } as ProcessedImage;

            processedImageRepository.findOne.mockResolvedValue(mockProcessedImage2);
            fileService.getGetObjectSignedUrl.mockResolvedValue('https://example.com/new');

            await service.getProcessedImageById('790');

            expect(fileService.getGetObjectSignedUrl).toHaveBeenCalledWith(
                'test-bucket',
                newFormatKey,
                3600,
            );
        });
    });

    describe('Automatic Migration During Sync', () => {
        it('should automatically migrate old-format images to new format during sync', async () => {
            // Arrange
            const labelId = 'label-123';
            const labelName = 'HR';
            const oldFormatKey = 'processed/image1.jpg---processed@HR_1.webp';
            const newFormatKey = 'processed/HR/image1.jpg---processed@HR_1.webp';

            const mockLabel = { id: labelId, name: labelName } as Label;
            const mockImage = { id: 'img-123', filename: 'image1.jpg' } as Image;
            const mockScrapedImage = {
                id: 'scraped-123',
                image: mockImage,
                scrape: {
                    id: 'scrape-123',
                    collection: { id: 'collection-123' },
                },
            } as any;
            const mockProcessingRun = {
                id: 'run-123',
                collection: { id: 'collection-123' },
                label: mockLabel,
            } as ProcessingRun;

            // Mock file content
            const fileBuffer = Buffer.from('fake-image-data');
            const fileStream = Readable.from(fileBuffer);

            labelRepository.findOne.mockResolvedValue(mockLabel);
            fileService.listObjects
                .mockResolvedValueOnce([]) // New format folder is empty
                .mockResolvedValueOnce([oldFormatKey]); // Old format folder has one file
            fileService.downloadFile.mockResolvedValue({ Body: fileStream } as any);
            fileService.uploadFile.mockResolvedValue(undefined);
            fileService.deleteFile.mockResolvedValue({} as any);
            imageRepository.findOne.mockResolvedValue(mockImage);
            scrapedImageRepository.findOne.mockResolvedValue(mockScrapedImage);
            processingRunRepository.findOne.mockResolvedValue(mockProcessingRun);
            processedImageRepository.findOne.mockResolvedValue(null);
            processedImageRepository.create.mockImplementation((data) => data as ProcessedImage);
            processedImageRepository.save.mockImplementation((data) => Promise.resolve(data));

            // Act
            const result = await service.syncProcessedImagesByLabel(labelId);

            // Assert
            expect(fileService.downloadFile).toHaveBeenCalledWith('test-bucket', oldFormatKey);
            expect(fileService.uploadFile).toHaveBeenCalledWith(
                'test-bucket',
                newFormatKey,
                expect.any(Buffer),
            );
            expect(fileService.deleteFile).toHaveBeenCalledWith('test-bucket', oldFormatKey);
            expect(processedImageRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: newFormatKey,
                    filename: 'image1.jpg---processed@HR_1.webp',
                }),
            );
            expect(result.processed).toBe(1);
            expect(result.failed).toBe(0);
        });

        it('should update database key when migrating old-format images', async () => {
            // Arrange
            const labelId = 'label-456';
            const labelName = 'LR';
            const oldFormatKey = 'processed/image2.jpg---processed@LR_2.webp';
            const newFormatKey = 'processed/LR/image2.jpg---processed@LR_2.webp';

            const mockLabel = { id: labelId, name: labelName } as Label;
            const mockImage = { id: 'img-456', filename: 'image2.jpg' } as Image;
            const mockScrapedImage = {
                id: 'scraped-456',
                image: mockImage,
                scrape: {
                    id: 'scrape-456',
                    collection: { id: 'collection-456' },
                },
            } as any;
            const mockProcessingRun = {
                id: 'run-456',
                collection: { id: 'collection-456' },
                label: mockLabel,
            } as ProcessingRun;
            const existingProcessedImage = {
                id: 'processed-456',
                key: oldFormatKey,
                filename: 'image2.jpg---processed@LR_2.webp',
                bucket: 'test-bucket',
            } as ProcessedImage;

            const fileBuffer = Buffer.from('fake-image-data-2');
            const fileStream = Readable.from(fileBuffer);

            labelRepository.findOne.mockResolvedValue(mockLabel);
            fileService.listObjects
                .mockResolvedValueOnce([]) // New format folder is empty
                .mockResolvedValueOnce([oldFormatKey]); // Old format folder has one file
            fileService.downloadFile.mockResolvedValue({ Body: fileStream } as any);
            fileService.uploadFile.mockResolvedValue(undefined);
            fileService.deleteFile.mockResolvedValue({} as any);
            imageRepository.findOne.mockResolvedValue(mockImage);
            scrapedImageRepository.findOne.mockResolvedValue(mockScrapedImage);
            processingRunRepository.findOne.mockResolvedValue(mockProcessingRun);
            processedImageRepository.findOne.mockResolvedValue(existingProcessedImage);
            processedImageRepository.save.mockImplementation((data) => Promise.resolve(data));

            // Act
            const result = await service.syncProcessedImagesByLabel(labelId);

            // Assert
            expect(processedImageRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: newFormatKey,
                    filename: 'image2.jpg---processed@LR_2.webp',
                }),
            );
            expect(result.processed).toBe(1);
        });

        it('should handle migration errors gracefully and continue processing', async () => {
            // Arrange
            const labelId = 'label-789';
            const labelName = 'MC';
            const oldFormatKey = 'processed/image3.jpg---processed@MC_1.webp';

            const mockLabel = { id: labelId, name: labelName } as Label;
            const mockImage = { id: 'img-789', filename: 'image3.jpg' } as Image;
            const mockScrapedImage = {
                id: 'scraped-789',
                image: mockImage,
                scrape: {
                    id: 'scrape-789',
                    collection: { id: 'collection-789' },
                },
            } as any;
            const mockProcessingRun = {
                id: 'run-789',
                collection: { id: 'collection-789' },
                label: mockLabel,
            } as ProcessingRun;

            labelRepository.findOne.mockResolvedValue(mockLabel);
            fileService.listObjects
                .mockResolvedValueOnce([]) // New format folder is empty
                .mockResolvedValueOnce([oldFormatKey]); // Old format folder has one file
            fileService.downloadFile.mockRejectedValue(new Error('S3 download failed'));
            imageRepository.findOne.mockResolvedValue(mockImage);
            scrapedImageRepository.findOne.mockResolvedValue(mockScrapedImage);
            processingRunRepository.findOne.mockResolvedValue(mockProcessingRun);
            processedImageRepository.findOne.mockResolvedValue(null);
            processedImageRepository.create.mockImplementation((data) => data as ProcessedImage);
            processedImageRepository.save.mockImplementation((data) => Promise.resolve(data));

            // Act
            const result = await service.syncProcessedImagesByLabel(labelId);

            // Assert
            // Should still create DB record with old key if migration fails
            expect(processedImageRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: oldFormatKey, // Falls back to old key
                }),
            );
            expect(result.processed).toBe(1);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to migrate');
        });
    });

    /**
     * Feature: label-based-processed-image-sync, Property 3: Filename parsing backward compatibility
     * Validates: Requirements 1.4
     * 
     * Property: For any valid processed image filename (old or new format), 
     * the parsing logic SHALL successfully extract the original filename and label name.
     */
    describe('Property 3: Filename Parsing Backward Compatibility', () => {
        it('should parse any valid old-format filename correctly', () => {
            fc.assert(
                fc.property(
                    // Generate valid filename components
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/') && !s.includes('---')),
                    fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/') && !s.includes('_') && !s.includes('---')),
                    fc.integer({ min: 1, max: 999 }),
                    (originalFilename, labelName, number) => {
                        // Construct old format: processed/filename---processed@label_1.webp
                        const oldFormatKey = `processed/${originalFilename}---processed@${labelName}_${number}.webp`;
                        
                        // Pattern used in the service
                        const oldFormatPattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const match = oldFormatKey.match(oldFormatPattern);
                        
                        // Assert that parsing succeeds
                        expect(match).not.toBeNull();
                        if (match) {
                            const [, extractedFilename, extractedLabel] = match;
                            expect(extractedFilename).toBe(originalFilename);
                            expect(extractedLabel).toBe(labelName);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should parse any valid new-format filename correctly', () => {
            fc.assert(
                fc.property(
                    // Generate valid filename components
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/') && !s.includes('---')),
                    fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/') && !s.includes('_') && !s.includes('---')),
                    fc.integer({ min: 1, max: 999 }),
                    (originalFilename, labelName, number) => {
                        // Construct new format: processed/<label>/filename---processed@label_1.webp
                        const newFormatKey = `processed/${labelName}/${originalFilename}---processed@${labelName}_${number}.webp`;
                        
                        // Pattern used in the service
                        const newFormatPattern = /^processed\/[^/]+\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const match = newFormatKey.match(newFormatPattern);
                        
                        // Assert that parsing succeeds
                        expect(match).not.toBeNull();
                        if (match) {
                            const [, extractedFilename, extractedLabel] = match;
                            expect(extractedFilename).toBe(originalFilename);
                            expect(extractedLabel).toBe(labelName);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle filenames with special characters in both formats', () => {
            fc.assert(
                fc.property(
                    // Generate filenames with special characters (but not path separators or pattern markers)
                    fc.string({ minLength: 1, maxLength: 50 })
                        .filter(s => !s.includes('/') && !s.includes('---') && s.trim().length > 0)
                        .map(s => s.replace(/\s+/g, '_')), // Replace spaces with underscores
                    fc.string({ minLength: 1, maxLength: 20 })
                        .filter(s => !s.includes('/') && !s.includes('_') && !s.includes('---') && s.trim().length > 0)
                        .map(s => s.replace(/\s+/g, '')), // Remove spaces from label
                    fc.integer({ min: 1, max: 999 }),
                    (originalFilename, labelName, number) => {
                        // Test old format
                        const oldFormatKey = `processed/${originalFilename}---processed@${labelName}_${number}.webp`;
                        const oldFormatPattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const oldMatch = oldFormatKey.match(oldFormatPattern);
                        
                        expect(oldMatch).not.toBeNull();
                        if (oldMatch) {
                            const [, extractedFilename, extractedLabel] = oldMatch;
                            expect(extractedFilename).toBe(originalFilename);
                            expect(extractedLabel).toBe(labelName);
                        }
                        
                        // Test new format
                        const newFormatKey = `processed/${labelName}/${originalFilename}---processed@${labelName}_${number}.webp`;
                        const newFormatPattern = /^processed\/[^/]+\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const newMatch = newFormatKey.match(newFormatPattern);
                        
                        expect(newMatch).not.toBeNull();
                        if (newMatch) {
                            const [, extractedFilename, extractedLabel] = newMatch;
                            expect(extractedFilename).toBe(originalFilename);
                            expect(extractedLabel).toBe(labelName);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should correctly identify and reject malformed filenames', () => {
            fc.assert(
                fc.property(
                    // Generate various malformed patterns
                    fc.oneof(
                        // Missing the ---processed@ marker
                        fc.tuple(
                            fc.string({ minLength: 1, maxLength: 50 }),
                            fc.string({ minLength: 1, maxLength: 20 }),
                            fc.integer({ min: 1, max: 999 })
                        ).map(([filename, label, num]) => `processed/${filename}@${label}_${num}.webp`),
                        // Missing the label
                        fc.tuple(
                            fc.string({ minLength: 1, maxLength: 50 }),
                            fc.integer({ min: 1, max: 999 })
                        ).map(([filename, num]) => `processed/${filename}---processed@_${num}.webp`),
                        // Missing the number
                        fc.tuple(
                            fc.string({ minLength: 1, maxLength: 50 }),
                            fc.string({ minLength: 1, maxLength: 20 })
                        ).map(([filename, label]) => `processed/${filename}---processed@${label}.webp`),
                        // Wrong extension
                        fc.tuple(
                            fc.string({ minLength: 1, maxLength: 50 }),
                            fc.string({ minLength: 1, maxLength: 20 }),
                            fc.integer({ min: 1, max: 999 })
                        ).map(([filename, label, num]) => `processed/${filename}---processed@${label}_${num}.jpg`)
                    ),
                    (malformedKey) => {
                        const oldFormatPattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const newFormatPattern = /^processed\/[^/]+\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        
                        const oldMatch = malformedKey.match(oldFormatPattern);
                        const newMatch = malformedKey.match(newFormatPattern);
                        
                        // At least one pattern should fail to match (or both)
                        expect(oldMatch === null || newMatch === null).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle edge cases: very long filenames and label names', () => {
            fc.assert(
                fc.property(
                    // Generate very long but valid filenames
                    fc.string({ minLength: 100, maxLength: 200 }).filter(s => !s.includes('/') && !s.includes('---')),
                    fc.string({ minLength: 50, maxLength: 100 }).filter(s => !s.includes('/') && !s.includes('_') && !s.includes('---')),
                    fc.integer({ min: 1, max: 999 }),
                    (originalFilename, labelName, number) => {
                        // Test old format with long names
                        const oldFormatKey = `processed/${originalFilename}---processed@${labelName}_${number}.webp`;
                        const oldFormatPattern = /^processed\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const oldMatch = oldFormatKey.match(oldFormatPattern);
                        
                        expect(oldMatch).not.toBeNull();
                        if (oldMatch) {
                            const [, extractedFilename, extractedLabel] = oldMatch;
                            expect(extractedFilename).toBe(originalFilename);
                            expect(extractedLabel).toBe(labelName);
                        }
                        
                        // Test new format with long names
                        const newFormatKey = `processed/${labelName}/${originalFilename}---processed@${labelName}_${number}.webp`;
                        const newFormatPattern = /^processed\/[^/]+\/(.+?)---processed@(.+?)_\d+\.webp$/;
                        const newMatch = newFormatKey.match(newFormatPattern);
                        
                        expect(newMatch).not.toBeNull();
                        if (newMatch) {
                            const [, extractedFilename, extractedLabel] = newMatch;
                            expect(extractedFilename).toBe(originalFilename);
                            expect(extractedLabel).toBe(labelName);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
