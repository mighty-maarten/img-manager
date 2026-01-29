import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { Collection } from '../database/entities/collection.entity';
import { ProcessingRun } from '../database/entities/processing-run.entity';
import { LabelContract } from '../labels/types';
import { ImageSizePreset, ScrapingMode } from '../scraping/types';

export enum ProcessedFilter {
    ALL = 'all',
    NONE = 'none',
    PARTIAL = 'partial',
}

export class ProcessingRunContract {
    @ApiProperty()
    public id: string;

    @ApiProperty()
    public labelId: string;

    @ApiProperty()
    public labelName: string;

    @ApiProperty()
    public createdOn: Date;

    @ApiProperty()
    public lastUpdatedOn: Date;

    constructor(processingRun: ProcessingRun) {
        this.id = processingRun.id;
        this.labelId = processingRun.label.id;
        this.labelName = processingRun.label.name;
        this.createdOn = processingRun.createdOn;
        this.lastUpdatedOn = processingRun.lastUpdatedOn;
    }
}

export class ScrapeInfoContract {
    @ApiProperty({ description: 'Scrape ID' })
    public id: string;

    @ApiProperty({ description: 'Scrape title' })
    public title: string;

    @ApiProperty({ enum: ScrapingMode, description: 'Scraping mode used' })
    public scrapeMode: ScrapingMode;

    @ApiProperty({ type: [String], description: 'Tags extracted from the scraped page' })
    public tags: string[];

    @ApiProperty({ type: [String], description: 'Categories extracted from the scraped page' })
    public categories: string[];

    @ApiProperty({ type: [String], description: 'Models extracted from the scraped page' })
    public models: string[];

    @ApiProperty({ description: 'Whether the scrape has been stored to S3' })
    public stored: boolean;

    constructor(
        id: string,
        title: string,
        scrapeMode: ScrapingMode,
        tags: string[],
        categories: string[],
        models: string[],
        stored: boolean,
    ) {
        this.id = id;
        this.title = title;
        this.scrapeMode = scrapeMode;
        this.tags = tags;
        this.categories = categories;
        this.models = models;
        this.stored = stored;
    }
}

export class CollectionContract {
    @ApiProperty()
    public id: string;

    @ApiProperty()
    public url: string;

    @ApiProperty({ type: [LabelContract] })
    public labels: LabelContract[];

    @ApiProperty({ type: [ProcessingRunContract] })
    public processingRuns: ProcessingRunContract[];

    @ApiProperty({ type: ScrapeInfoContract, required: false })
    public scrape?: ScrapeInfoContract;

    @ApiProperty()
    public stored: boolean;

    @ApiProperty()
    public createdOn: Date;

    @ApiProperty()
    public lastUpdatedOn: Date;

    constructor(collection: Collection) {
        this.id = collection.id;
        this.url = collection.url;
        this.labels = collection.labels
            ? collection.labels.map((label) => new LabelContract(label))
            : [];
        this.processingRuns = collection.processingRuns
            ? collection.processingRuns.map((run) => new ProcessingRunContract(run))
            : [];
        this.scrape = collection.scrape
            ? new ScrapeInfoContract(
                  collection.scrape.id,
                  collection.scrape.title,
                  collection.scrape.scrapingMode,
                  collection.scrape.tags,
                  collection.scrape.categories,
                  collection.scrape.models,
                  collection.scrape.stored,
              )
            : undefined;
        this.stored = collection.scrape ? collection.scrape.stored : false;
        this.createdOn = collection.createdOn;
        this.lastUpdatedOn = collection.lastUpdatedOn;
    }
}

export class UpdateCollectionContract {
    @ApiProperty({ description: 'URL of the collection', required: false })
    @IsUrl()
    @IsOptional()
    public url?: string;

    @ApiProperty({
        type: [String],
        required: false,
        description: 'Label IDs to associate with the collection',
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public labelIds?: string[];
}

export class ScrapeCollectionContract {
    @ApiProperty({
        enum: ImageSizePreset,
        description: 'Size preset for filtering images',
        example: ImageSizePreset.MEDIUM,
    })
    @IsEnum(ImageSizePreset)
    @IsNotEmpty()
    public sizePreset!: ImageSizePreset;

    @ApiProperty({
        enum: ScrapingMode,
        description: 'Scraping mode (light or heavy)',
        example: ScrapingMode.LIGHT,
    })
    @IsEnum(ScrapingMode)
    @IsNotEmpty()
    public scrapingMode!: ScrapingMode;
}

export class CreateCollectionsContract {
    @ApiProperty({
        type: [String],
        description: 'Array of collection URLs to create',
        example: ['https://example.com/collection1', 'https://example.com/collection2'],
    })
    @IsArray()
    @IsUrl({ require_tld: false }, { each: true })
    @IsNotEmpty({ each: true })
    public urls!: string[];

    @ApiProperty({
        type: [String],
        required: false,
        description: 'Label IDs to associate with all collections',
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    public labelIds?: string[];
}

export class CreateCollectionsResultContract {
    @ApiProperty({
        type: [CollectionContract],
        description: 'Successfully created collections',
    })
    public created: CollectionContract[];

    @ApiProperty({
        type: Object,
        description: 'Failed collections with error messages',
        example: { 'https://example.com/collection': 'Collection already exists' },
    })
    public failed: Record<string, string>;

    constructor(created: CollectionContract[], failed: Record<string, string>) {
        this.created = created;
        this.failed = failed;
    }
}

export class CollectionDownloadUrlContract {
    @ApiProperty({ description: 'Image ID' })
    public imageId: string;

    @ApiProperty({ description: 'Original filename' })
    public filename: string;

    @ApiProperty({ description: 'Presigned S3 download URL' })
    public downloadUrl: string;

    @ApiProperty({ description: 'URL expiration timestamp' })
    public expiresAt: Date;

    constructor(imageId: string, filename: string, downloadUrl: string, expiresAt: Date) {
        this.imageId = imageId;
        this.filename = filename;
        this.downloadUrl = downloadUrl;
        this.expiresAt = expiresAt;
    }
}

export class CollectionDownloadUrlsContract {
    @ApiProperty({
        type: [CollectionDownloadUrlContract],
        description: 'Presigned download URLs for all downloaded images in the collection',
    })
    public downloads: CollectionDownloadUrlContract[];

    constructor(downloads: CollectionDownloadUrlContract[]) {
        this.downloads = downloads;
    }
}
