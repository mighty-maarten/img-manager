import { defineStore } from 'pinia';
import { useStoreCreationUtils } from './util';
import { ProcessedImageService } from '@/api/services/processed-image.ts';
import type {
    ProcessedImage,
    GetProcessedImagesQuery,
} from '@/api/services/types/processed-image';
import { ref } from 'vue';

export const useProcessedImagesStore = defineStore('processed-images', () => {
    const { base, handleAction } = useStoreCreationUtils({
        actions: ['fetchProcessedImages', 'fetchProcessedImage', 'updateProcessedImageHidden', 'updateProcessedImageFlagged', 'updateProcessedImageScore'],
    });

    const processedImages = ref<ProcessedImage[]>([]);
    const totalProcessedImages = ref<number>(0);
    const currentImage = ref<ProcessedImage | null>(null);
    const currentRunId = ref<string | null>(null);

    // Pagination state
    const first = ref<number>(0);
    const rows = ref<number>(20);

    // Sorting state
    const sortField = ref<string | undefined>(undefined);
    const sortOrder = ref<1 | -1 | undefined>(undefined);

    // Filter state - default to showing not hidden images
    const hiddenFilter = ref<boolean | null>(false);
    const flaggedFilter = ref<boolean | null>(null);
    const minimalScoreFilter = ref<number | null>(null);
    const labelsFilter = ref<string[]>([]);

    // In-memory cache (clears when browser window/tab closes)
    const imageListCache = new Map<string, { results: ProcessedImage[]; count: number }>();
    const imageDetailCache = new Map<string, ProcessedImage>();

    // Helper function to generate cache key for image list queries
    function generateListCacheKey(runId?: string, query?: GetProcessedImagesQuery): string {
        const parts = [
            runId ?? 'all',
            query?.skip ?? 0,
            query?.take ?? 20,
            query?.sort?.field ?? 'none',
            query?.sort?.order ?? 0,
            query?.hidden ?? 'null',
            query?.flagged ?? 'null',
            query?.minimalScore ?? 'null',
            query?.labelIds ?? 'null'
        ];
        return parts.join('|');
    }

    // Helper function to invalidate cache entries affected by state changes
    function invalidateCacheForStateChange(imageId: string, property: 'hidden' | 'flagged'): void {
        const keysToDelete: string[] = [];

        imageListCache.forEach((cachedList, cacheKey) => {
            // Parse the cache key to understand the filters
            const parts = cacheKey.split('|');
            // Cache key format: runId|skip|take|sortField|sortOrder|hidden|flagged|minimalScore|labelIds
            const hiddenFilterValue = parts[5]; // 'true', 'false', or 'null'
            const flaggedFilterValue = parts[6]; // 'true', 'false', or 'null'

            let shouldInvalidate = false;

            if (property === 'hidden') {
                // If the cache key has a hidden filter (not 'null'), it needs invalidation
                // because the image's hidden state is changing
                if (hiddenFilterValue !== 'null') {
                    shouldInvalidate = true;
                }
            } else if (property === 'flagged') {
                // If the cache key has a flagged filter (not 'null'), it needs invalidation
                // because the image's flagged state is changing
                if (flaggedFilterValue !== 'null') {
                    shouldInvalidate = true;
                }
            }

            if (shouldInvalidate) {
                keysToDelete.push(cacheKey);
            }
        });

        // Remove the invalidated cache entries
        keysToDelete.forEach(key => imageListCache.delete(key));
    }

    // Helper function to update an image in all caches
    function updateImageInCaches(id: string, updatedImage: ProcessedImage): void {
        // Update detail cache
        imageDetailCache.set(id, updatedImage);

        // Update image in all cached lists
        imageListCache.forEach((cachedList) => {
            const imgIndex = cachedList.results.findIndex(img => img.id === id);
            if (imgIndex !== -1) {
                cachedList.results[imgIndex] = updatedImage;
            }
        });
    }

    async function fetchProcessedImages(runId?: string, query?: GetProcessedImagesQuery): Promise<void> {
        await handleAction('fetchProcessedImages', undefined, async () => {
            const cacheKey = generateListCacheKey(runId, query);

            // Check cache first
            const cachedData = imageListCache.get(cacheKey);
            if (cachedData) {
                processedImages.value = cachedData.results;
                totalProcessedImages.value = cachedData.count;
                currentRunId.value = runId ?? null;
                return;
            }

            // Fetch from API if not cached
            const result = await ProcessedImageService.getProcessedImages(runId, query);
            processedImages.value = result.results;
            totalProcessedImages.value = result.count;
            currentRunId.value = runId ?? null;

            // Store in cache
            imageListCache.set(cacheKey, { results: result.results, count: result.count });

            // Also cache individual images for detail view
            result.results.forEach(image => {
                imageDetailCache.set(image.id, image);
            });
        });
    }

    async function fetchProcessedImage(id: string): Promise<ProcessedImage | null> {
        let result: ProcessedImage | null = null;
        await handleAction('fetchProcessedImage', id, async () => {
            // Check cache first
            const cachedImage = imageDetailCache.get(id);
            if (cachedImage) {
                result = cachedImage;
                currentImage.value = cachedImage;
                return;
            }

            // Fetch from API if not cached
            result = await ProcessedImageService.getProcessedImage(id);
            currentImage.value = result;

            // Store in cache
            if (result) {
                imageDetailCache.set(id, result);
            }
        });
        return result;
    }

    async function updateProcessedImageHidden(id: string, hidden: boolean): Promise<void> {
        await handleAction('updateProcessedImageHidden', id, async () => {
            // Invalidate affected cache entries BEFORE making the API call
            invalidateCacheForStateChange(id, 'hidden');

            const updatedImage = await ProcessedImageService.updateProcessedImageHidden(id, hidden);

            // Update the image in the local state using splice for guaranteed reactivity
            const index = processedImages.value.findIndex(img => img.id === id);
            if (index !== -1) {
                processedImages.value.splice(index, 1, updatedImage);
            }

            // Update current image if viewing detail
            if (currentImage.value?.id === id) {
                currentImage.value = updatedImage;
            }

            // Update remaining non-invalidated caches
            updateImageInCaches(id, updatedImage);
        });
    }

    async function updateProcessedImageFlagged(id: string, flagged: boolean): Promise<void> {
        await handleAction('updateProcessedImageFlagged', id, async () => {
            // Invalidate affected cache entries BEFORE making the API call
            invalidateCacheForStateChange(id, 'flagged');

            const updatedImage = await ProcessedImageService.updateProcessedImageFlagged(id, flagged);

            // Update the image in the local state using splice for guaranteed reactivity
            const index = processedImages.value.findIndex(img => img.id === id);
            if (index !== -1) {
                processedImages.value.splice(index, 1, updatedImage);
            }

            // Update current image if viewing detail
            if (currentImage.value?.id === id) {
                currentImage.value = updatedImage;
            }

            // Update remaining non-invalidated caches
            updateImageInCaches(id, updatedImage);
        });
    }

    async function updateProcessedImageScore(id: string, score: number | null): Promise<void> {
        await handleAction('updateProcessedImageScore', id, async () => {
            const updatedImage = await ProcessedImageService.updateProcessedImageScore(id, score);

            // Update the image in the local state using splice for guaranteed reactivity
            const index = processedImages.value.findIndex(img => img.id === id);
            if (index !== -1) {
                processedImages.value.splice(index, 1, updatedImage);
            }

            // Update current image if viewing detail
            if (currentImage.value?.id === id) {
                currentImage.value = updatedImage;
            }

            // Update cache
            updateImageInCaches(id, updatedImage);
        });
    }

    // Update pagination state
    function updatePagination(newFirst: number, newRows: number): void {
        first.value = newFirst;
        rows.value = newRows;
    }

    // Update sorting state
    function updateSorting(field: string | undefined, order: 1 | -1 | undefined): void {
        sortField.value = field;
        sortOrder.value = order;
    }

    // Update filter state
    function updateFilters(hidden: boolean | null, minimalScore?: number | null, flagged?: boolean | null, labels?: string[]): void {
        hiddenFilter.value = hidden;
        if (minimalScore !== undefined) {
            minimalScoreFilter.value = minimalScore;
        }
        if (flagged !== undefined) {
            flaggedFilter.value = flagged;
        }
        if (labels !== undefined) {
            labelsFilter.value = labels;
        }
    }

    // Reset pagination to first page
    function resetPagination(): void {
        first.value = 0;
    }

    // Get adjacent image IDs for navigation (with circular/infinite navigation)
    function getAdjacentImageIds(currentId: string): { prevId: string | null; nextId: string | null } {
        const index = processedImages.value.findIndex(img => img.id === currentId);

        if (index === -1 || processedImages.value.length === 0) {
            return { prevId: null, nextId: null };
        }

        // Circular navigation: wrap around to the end/beginning
        const prevIndex = index > 0 ? index - 1 : processedImages.value.length - 1;
        const nextIndex = index < processedImages.value.length - 1 ? index + 1 : 0;

        const prevId = processedImages.value[prevIndex]?.id ?? null;
        const nextId = processedImages.value[nextIndex]?.id ?? null;

        return { prevId, nextId };
    }

    // Clear all caches (useful for forcing a refresh or after syncing images)
    function clearCache(): void {
        imageListCache.clear();
        imageDetailCache.clear();
    }

    return {
        ...base,
        processedImages,
        totalProcessedImages,
        currentImage,
        currentRunId,
        // State
        first,
        rows,
        sortField,
        sortOrder,
        hiddenFilter,
        flaggedFilter,
        minimalScoreFilter,
        labelsFilter,
        // Actions
        fetchProcessedImages,
        fetchProcessedImage,
        updateProcessedImageHidden,
        updateProcessedImageFlagged,
        updateProcessedImageScore,
        updatePagination,
        updateSorting,
        updateFilters,
        resetPagination,
        getAdjacentImageIds,
        clearCache,
    };
});
