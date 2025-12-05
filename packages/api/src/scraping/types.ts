export enum ImageSizePreset {
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large',
    ALL = 'all',
}

export enum ScrapingMode {
    LIGHT = 'light', // Quick: Only extract URLs from HTML, no downloading/processing
    HEAVY = 'heavy', // Thorough: Download and process all images with thumbnails
}

export interface ScrapeConfigContract {
    urls: string[];
    sizePreset: ImageSizePreset;
    scrapingMode: ScrapingMode;
}

export interface ImageMetadataContract {
    id: string;
    filename: string;
    url: string;
    sourceUrl: string; // The page URL where the image was found
    width?: number; // Optional in light mode
    height?: number; // Optional in light mode
    fileSize?: number; // Optional in light mode
    format?: string; // Optional in light mode
}

export interface ScrapeResultContract {
    images: ImageMetadataContract[];
    scrapeMode: ScrapingMode;
    tags: string[];
    categories: string[];
    models: string[];
    title: string;
    errors: {
        url: string;
        error: string;
    }[];
}
