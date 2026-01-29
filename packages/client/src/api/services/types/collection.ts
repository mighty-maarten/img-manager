import type { Label } from './label.ts';

export enum ScrapingMode {
    LIGHT = 'light',
    HEAVY = 'heavy',
}

export type ProcessingRun = {
    id: string;
    labelId: string;
    labelName: string;
    createdOn: Date;
    lastUpdatedOn: Date;
};

export type ScrapeIfo = {
    id: string;
    title: string;
    scrapeMode: ScrapingMode;
    tags: string[];
    categories: string[];
    models: string[];
};

export type Collection = {
    id: string;
    url: string;
    labels: Label[];
    scrape?: ScrapeIfo;
    stored: boolean;
    createdOn: Date;
    lastUpdatedOn: Date;
    processingRuns: ProcessingRun[];
};

export type UpdateCollectionRequest = {
    url?: string;
    labelIds?: string[];
};

export type ScrapeCollectionRequest = {
    sizePreset: string;
    scrapingMode: string;
};

export type ScrapeResult = {
    title: string;
    scrapeMode: ScrapingMode;
    images: ImageMetadata[];
    tags: string[];
    categories: string[];
    models: string[];
    errors: {
        url: string;
        error: string;
    }[];
};

export type ImageMetadata = {
    id: string;
    filename: string;
    url: string;
    sourceUrl: string; // The page URL where the image was found
    width?: number; // Optional in light mode
    height?: number; // Optional in light mode
    fileSize?: number; // Optional in light mode
    format?: string; // Optional in light mode
};

export class CreateCollectionsContract {
    public urls!: string[];
    public labelIds?: string[];
}

export class CreateCollectionsResultContract {
    public created: Collection[];
    public failed: Record<string, string>;

    constructor(created: Collection[], failed: Record<string, string>) {
        this.created = created;
        this.failed = failed;
    }
}

export interface SortMeta {
    field: string;
    order: 1 | -1;
}

export enum ProcessedFilter {
    ALL = 'all',
    NONE = 'none',
    PARTIAL = 'partial',
}

export type GetCollectionsQuery = {
    take?: number;
    skip?: number;
    sort?: SortMeta;
    scraped?: boolean;
    stored?: boolean;
    processed?: ProcessedFilter;
    labelIds?: string;
};

export type PagedResult<T> = {
    results: T[];
    count: number;
};

export type CollectionDownloadUrl = {
    imageId: string;
    filename: string;
    downloadUrl: string;
    expiresAt: Date;
};

export type CollectionDownloadUrls = {
    downloads: CollectionDownloadUrl[];
};
