import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as sharp from 'sharp';

import { v4 as uuidv4 } from 'uuid';
import {
    ImageMetadataContract,
    ImageSizePreset,
    ScrapeConfigContract,
    ScrapeResultContract,
    ScrapingMode,
} from './types';

@Injectable()
export class ScrapingService {
    private readonly logger = new Logger(ScrapingService.name);

    async scrapeImages(config: ScrapeConfigContract): Promise<ScrapeResultContract> {
        const imageUrlsMap = new Map<string, ImageMetadataContract>();
        const imageFilenamesSet = new Set<string>();
        const errors: { url: string; error: string }[] = [];
        const allTags = new Set<string>();
        const allCategories = new Set<string>();
        const allModels = new Set<string>();
        let title = 'Unknown';

        for (const url of config.urls) {
            try {
                this.logger.log(`Scraping URL: ${url}`);
                const result = await this.scrapeUrl(url, config);

                // Deduplicate across all pages by URL and filename
                result.images.forEach((image) => {
                    if (!imageUrlsMap.has(image.url) && !imageFilenamesSet.has(image.filename)) {
                        imageUrlsMap.set(image.url, image);
                        imageFilenamesSet.add(image.filename);
                    }
                });

                // Aggregate metadata
                result.metadata.tags.forEach((tag) => allTags.add(tag));
                result.metadata.categories.forEach((category) => allCategories.add(category));
                result.metadata.models.forEach((model) => allModels.add(model));

                // Use the first non-"Unknown" title
                if (
                    title === 'Unknown' &&
                    result.metadata.title &&
                    result.metadata.title !== 'Unknown'
                ) {
                    title = result.metadata.title;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error scraping ${url}:`, errorMessage);
                errors.push({ url, error: errorMessage });
            }
        }

        const allImages = Array.from(imageUrlsMap.values());

        return {
            images: allImages,
            scrapeMode: config.scrapingMode,
            tags: Array.from(allTags),
            categories: Array.from(allCategories),
            models: Array.from(allModels),
            title,
            errors,
        };
    }

    private async scrapeUrl(
        url: string,
        config: ScrapeConfigContract,
    ): Promise<{
        images: ImageMetadataContract[];
        metadata: {
            title: string | undefined;
            tags: string[];
            categories: string[];
            models: string[];
        };
    }> {
        if (config.scrapingMode === ScrapingMode.LIGHT) {
            return this.scrapeUrlLight(url, config);
        } else {
            return this.scrapeUrlHeavy(url, config);
        }
    }

    private async scrapeUrlLight(
        url: string,
        config: ScrapeConfigContract,
    ): Promise<{
        images: ImageMetadataContract[];
        metadata: { tags: string[]; categories: string[]; models: string[]; title: string };
    }> {
        // Fetch HTML
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 30000,
        });

        const $ = cheerio.load(response.data);
        const imageUrlsMap = new Map<string, ImageMetadataContract>();
        const metadata = this.parseMetadata($);
        const title = this.parseTitle($);

        // Extract image URLs from various sources without downloading
        $('img').each((_, element) => {
            const src = $(element).attr('src');
            const srcset = $(element).attr('srcset');
            const dataSrc = $(element).attr('data-src');
            const width = $(element).attr('width');
            const height = $(element).attr('height');

            // Check if img is inside an <a> tag with an image href
            const parentAnchor = $(element).parent('a');
            let anchorImageUrl: string | undefined;
            let pswpWidth: number | undefined;
            let pswpHeight: number | undefined;

            if (parentAnchor.length > 0) {
                const href = parentAnchor.attr('href');
                if (href) {
                    const resolvedHref = this.resolveUrl(href, url);
                    if (this.isImageUrl(resolvedHref)) {
                        anchorImageUrl = resolvedHref;

                        // Extract data-pswp dimensions
                        const dataPswpWidth = parentAnchor.attr('data-pswp-width');
                        const dataPswpHeight = parentAnchor.attr('data-pswp-height');

                        if (dataPswpWidth) pswpWidth = parseInt(dataPswpWidth);
                        if (dataPswpHeight) pswpHeight = parseInt(dataPswpHeight);
                    }
                }
            }

            const processImgTag = (imgUrl: string) => {
                // If there's an anchor with an image URL, use that instead
                const finalUrl = anchorImageUrl || imgUrl;
                const resolvedUrl = this.resolveUrl(finalUrl, url);

                // Skip data URLs in light mode
                if (resolvedUrl.startsWith('data:')) return;

                // Skip if already processed
                if (imageUrlsMap.has(resolvedUrl)) return;

                // Skip SVG files (typically logos/icons, not downloadable images)
                if (resolvedUrl.toLowerCase().split('?')[0].endsWith('.svg')) return;

                // Determine final width/height (prefer data-pswp, then HTML attributes)
                const finalWidth = pswpWidth || (width ? parseInt(width) : undefined);
                const finalHeight = pswpHeight || (height ? parseInt(height) : undefined);

                // Apply size filtering in light mode if dimensions are available
                if (finalWidth && finalHeight) {
                    if (!this.matchesSizeCriteriaByDimensions(finalWidth, finalHeight, config)) {
                        return; // Skip images that don't match size criteria
                    }
                }

                imageUrlsMap.set(resolvedUrl, {
                    id: uuidv4(),
                    url: resolvedUrl,
                    sourceUrl: url,
                    filename: this.extractFilename(resolvedUrl),
                    width: finalWidth,
                    height: finalHeight,
                });
            };

            if (src) processImgTag(src);
            if (dataSrc) processImgTag(dataSrc);
            if (srcset) {
                // Parse srcset and get the largest image
                const srcsetUrls = srcset
                    .split(',')
                    .map((s) => s.trim().split(' ')[0])
                    .filter((s) => s);
                srcsetUrls.forEach((srcUrl) => processImgTag(srcUrl));
            }
        });

        // Extract from picture elements
        $('picture source').each((_, element) => {
            const srcset = $(element).attr('srcset');
            if (srcset) {
                const srcsetUrls = srcset
                    .split(',')
                    .map((s) => s.trim().split(' ')[0])
                    .filter((s) => s);
                srcsetUrls.forEach((srcUrl) => {
                    const resolvedUrl = this.resolveUrl(srcUrl, url);
                    if (resolvedUrl.startsWith('data:')) return;

                    // Skip if already processed
                    if (imageUrlsMap.has(resolvedUrl)) return;

                    // Skip SVG files
                    if (resolvedUrl.toLowerCase().split('?')[0].endsWith('.svg')) return;

                    imageUrlsMap.set(resolvedUrl, {
                        id: uuidv4(),
                        url: resolvedUrl,
                        sourceUrl: url,
                        filename: this.extractFilename(resolvedUrl),
                    });
                });
            }
        });

        return {
            images: Array.from(imageUrlsMap.values()),
            metadata: { ...metadata, title },
        };
    }

    private async scrapeUrlHeavy(
        url: string,
        config: ScrapeConfigContract,
    ): Promise<{
        images: ImageMetadataContract[];
        metadata: { tags: string[]; categories: string[]; models: string[]; title: string };
    }> {
        // Fetch HTML
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 30000,
        });

        const $ = cheerio.load(response.data);
        const metadata = this.parseMetadata($);
        const title = this.parseTitle($);
        const imageUrls = new Set<string>();

        // Extract image URLs from various sources
        $('img').each((_, element) => {
            const src = $(element).attr('src');
            const srcset = $(element).attr('srcset');
            const dataSrc = $(element).attr('data-src');

            // Check if img is inside an <a> tag with an image href
            const parentAnchor = $(element).parent('a');
            let anchorImageUrl: string | undefined;
            if (parentAnchor.length > 0) {
                const href = parentAnchor.attr('href');
                if (href) {
                    const resolvedHref = this.resolveUrl(href, url);
                    if (this.isImageUrl(resolvedHref)) {
                        anchorImageUrl = resolvedHref;
                    }
                }
            }

            // If there's an anchor with an image URL, use that instead of img sources
            if (anchorImageUrl) {
                imageUrls.add(anchorImageUrl);
            } else {
                if (src) imageUrls.add(this.resolveUrl(src, url));
                if (dataSrc) imageUrls.add(this.resolveUrl(dataSrc, url));
                if (srcset) {
                    // Parse srcset
                    const srcsetUrls = srcset
                        .split(',')
                        .map((s) => s.trim().split(' ')[0])
                        .filter((s) => s);
                    srcsetUrls.forEach((srcUrl) => imageUrls.add(this.resolveUrl(srcUrl, url)));
                }
            }
        });

        // Extract from picture elements
        $('picture source').each((_, element) => {
            const srcset = $(element).attr('srcset');
            if (srcset) {
                const srcsetUrls = srcset
                    .split(',')
                    .map((s) => s.trim().split(' ')[0])
                    .filter((s) => s);
                srcsetUrls.forEach((srcUrl) => imageUrls.add(this.resolveUrl(srcUrl, url)));
            }
        });

        // Process each image
        const imageMetadataPromises = Array.from(imageUrls).map((imageUrl) =>
            this.processImage(imageUrl, url, config),
        );

        const results = await Promise.allSettled(imageMetadataPromises);
        const images = results
            .filter((r) => r.status === 'fulfilled')
            .map((r) => (r as PromiseFulfilledResult<ImageMetadataContract>).value)
            .filter((img) => img !== null);

        return {
            images,
            metadata: { ...metadata, title },
        };
    }

    private async processImage(
        imageUrl: string,
        sourceUrl: string,
        config: ScrapeConfigContract,
    ): Promise<ImageMetadataContract | null> {
        try {
            // Skip SVG files (typically logos/icons, not downloadable images)
            if (imageUrl.toLowerCase().split('?')[0].endsWith('.svg')) {
                return null;
            }

            // Fetch image
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            const buffer = Buffer.from(response.data);
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // Check if image matches size criteria
            if (!this.matchesSizeCriteria(metadata, config)) {
                return null;
            }

            // Generate thumbnail
            // const thumbnailDataUrl = await generateThumbnailDataUrl(buffer);

            // Extract filename from URL
            const filename = this.extractFilename(imageUrl);

            return {
                id: uuidv4(),
                url: imageUrl,
                sourceUrl,
                width: metadata.width,
                height: metadata.height,
                fileSize: buffer.length,
                format: metadata.format,
                filename,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to process image ${imageUrl}:`, errorMessage);
            return null;
        }
    }

    private matchesSizeCriteria(metadata: sharp.Metadata, config: ScrapeConfigContract): boolean {
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        return this.matchesSizeCriteriaByDimensions(width, height, config);
    }

    private matchesSizeCriteriaByDimensions(
        width: number,
        height: number,
        config: ScrapeConfigContract,
    ): boolean {
        // Apply size preset
        switch (config.sizePreset) {
            case ImageSizePreset.SMALL:
                if (width > 500 || height > 500) return false;
                break;
            case ImageSizePreset.MEDIUM:
                if (width < 500 || height < 500 || width > 1500 || height > 1500) return false;
                break;
            case ImageSizePreset.LARGE:
                if (width < 1500 || height < 1500) return false;
                break;
            case ImageSizePreset.ALL:
                // No filtering by preset
                break;
        }

        return true;
    }

    private resolveUrl(imageUrl: string, baseUrl: string): string {
        // Skip data URLs
        if (imageUrl.startsWith('data:')) return imageUrl;

        // If already absolute, return as-is
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        // Handle protocol-relative URLs
        if (imageUrl.startsWith('//')) {
            const protocol = new URL(baseUrl).protocol;
            return `${protocol}${imageUrl}`;
        }

        // Handle relative URLs
        try {
            return new URL(imageUrl, baseUrl).href;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to resolve URL: ${imageUrl}`, errorMessage);
            return imageUrl;
        }
    }

    private extractFilename(url: string): string {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const segments = pathname.split('/');
            const filename = segments[segments.length - 1] || 'image';

            // Clean up query parameters
            return filename.split('?')[0] || 'image';
        } catch (error) {
            return 'image';
        }
    }

    private isImageUrl(url: string): boolean {
        const imageExtensions = [
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.webp',
            '.bmp',
            '.svg',
            '.ico',
            '.avif',
        ];
        const urlLower = url.toLowerCase().split('?')[0]; // Remove query params
        return imageExtensions.some((ext) => urlLower.endsWith(ext));
    }

    private parseGalleryInfoSection($: cheerio.CheerioAPI, titleKeyword: string): string[] {
        const items: string[] = [];

        $('.gallery-info__item').each((_, element) => {
            const title = $(element).find('.gallery-info__title').text().trim().toLowerCase();
            if (title.includes(titleKeyword.toLowerCase())) {
                $(element)
                    .find('.gallery-info__content a span')
                    .each((_, span) => {
                        const text = $(span).text().trim();
                        if (text && !items.includes(text)) {
                            items.push(text);
                        }
                    });
            }
        });

        return items;
    }

    private parseMetadata($: cheerio.CheerioAPI): {
        tags: string[];
        categories: string[];
        models: string[];
    } {
        return {
            models: this.parseGalleryInfoSection($, 'model'),
            categories: this.parseGalleryInfoSection($, 'categor'),
            tags: this.parseGalleryInfoSection($, 'tag'),
        };
    }

    private parseTitle($: cheerio.CheerioAPI): string {
        // Try to get the title from the gallery section first
        const galleryTitle = $('div.title-section.filters.gallery h1').first().text().trim();
        if (galleryTitle) {
            return galleryTitle;
        }

        // Fallback to the page title in the head section
        const pageTitle = $('head title').first().text().trim();
        if (pageTitle) {
            return pageTitle;
        }

        // Default fallback
        return 'Unknown';
    }
}
