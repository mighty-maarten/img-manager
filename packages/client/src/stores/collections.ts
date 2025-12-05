import { defineStore } from 'pinia';
import { useStoreCreationUtils } from './util';
import { CollectionService } from '@/api/services/collection';
import type { Collection, UpdateCollectionRequest, ScrapeCollectionRequest, ScrapeResult, CreateCollectionsContract, CreateCollectionsResultContract, GetCollectionsQuery } from '@/api/services/types/collection';
import { ref } from 'vue';

export const useCollectionsStore = defineStore('collections', () => {
    const { base, handleAction } = useStoreCreationUtils({
        actions: ['fetchCollections', 'fetchCollection', 'createCollections', 'updateCollection', 'deleteCollection', 'scrapeCollection', 'fetchScrapeResult'],
    });

    const collections = ref<Collection[]>([]);
    const totalCollections = ref<number>(0);
    const currentScrapeResult = ref<ScrapeResult | null>(null);

    // Pagination state
    const first = ref<number>(0);
    const rows = ref<number>(50);

    // Sorting state
    const sortField = ref<string | undefined>(undefined);
    const sortOrder = ref<1 | -1 | undefined>(undefined);

    // Filter state
    const scrapedFilter = ref<boolean | null>(null);
    const storedFilter = ref<boolean | null>(null);
    const processedFilter = ref<boolean | null>(null);
    const labelsFilter = ref<string[]>([]);

    async function fetchCollections(query?: GetCollectionsQuery): Promise<void> {
        await handleAction('fetchCollections', undefined, async () => {
            const result = await CollectionService.getCollections(query);
            collections.value = result.results;
            totalCollections.value = result.count;
        });
    }

    async function fetchCollection(id: string): Promise<Collection | null> {
        let result: Collection | null = null;
        await handleAction('fetchCollection', id, async () => {
            result = await CollectionService.getCollection(id);
            // Add or update the collection in the store
            if (result) {
                const index = collections.value.findIndex((c) => c.id === id);
                if (index !== -1) {
                    collections.value[index] = result;
                } else {
                    collections.value.push(result);
                }
            }
        });
        return result;
    }

    async function createCollections(data: CreateCollectionsContract): Promise<CreateCollectionsResultContract | null> {
        let result: CreateCollectionsResultContract | null = null;
        await handleAction('createCollections', undefined, async () => {
            result = await CollectionService.createCollections(data);
            // Add successfully created collections to the store
            if (result && result.created.length > 0) {
                collections.value.push(...result.created);
            }
        });
        return result;
    }

    async function updateCollection(id: string, data: UpdateCollectionRequest): Promise<void> {
        await handleAction('updateCollection', id, async () => {
            const updatedCollection = await CollectionService.updateCollection(id, data);
            const index = collections.value.findIndex((c) => c.id === id);
            if (index !== -1) {
                collections.value[index] = updatedCollection;
            }
        });
    }

    async function deleteCollection(id: string): Promise<void> {
        await handleAction('deleteCollection', id, async () => {
            await CollectionService.deleteCollection(id);
            collections.value = collections.value.filter((c) => c.id !== id);
        });
    }

    async function scrapeCollection(id: string, data: ScrapeCollectionRequest): Promise<ScrapeResult | null> {
        let result: ScrapeResult | null = null;
        await handleAction('scrapeCollection', id, async () => {
            result = await CollectionService.scrapeCollection(id, data);
        });
        return result;
    }

    async function fetchScrapeResult(collectionId: string, scrapeId: string): Promise<ScrapeResult | null> {
        let result: ScrapeResult | null = null;
        await handleAction('fetchScrapeResult', collectionId, async () => {
            result = await CollectionService.getScrapeResult(collectionId, scrapeId);
            currentScrapeResult.value = result;
        });
        return result;
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
    function updateFilters(scraped: boolean | null, stored: boolean | null, processed: boolean | null, labels?: string[]): void {
        scrapedFilter.value = scraped;
        storedFilter.value = stored;
        processedFilter.value = processed;
        if (labels !== undefined) {
            labelsFilter.value = labels;
        }
    }

    // Reset pagination to first page
    function resetPagination(): void {
        first.value = 0;
    }

    // Get adjacent image indexes for navigation in scrape results (with circular/infinite navigation)
    function getScrapeImageAdjacentIndexes(currentIndex: number): { prevIndex: number | null; nextIndex: number | null } {
        if (!currentScrapeResult.value || currentScrapeResult.value.images.length === 0) {
            return { prevIndex: null, nextIndex: null };
        }

        const totalImages = currentScrapeResult.value.images.length;

        if (currentIndex < 0 || currentIndex >= totalImages) {
            return { prevIndex: null, nextIndex: null };
        }

        // Circular navigation: wrap around to the end/beginning
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : totalImages - 1;
        const nextIndex = currentIndex < totalImages - 1 ? currentIndex + 1 : 0;

        return { prevIndex, nextIndex };
    }

    return {
        ...base,
        collections,
        totalCollections,
        currentScrapeResult,
        // State
        first,
        rows,
        sortField,
        sortOrder,
        scrapedFilter,
        storedFilter,
        processedFilter,
        labelsFilter,
        // Actions
        fetchCollections,
        fetchCollection,
        createCollections,
        updateCollection,
        deleteCollection,
        scrapeCollection,
        fetchScrapeResult,
        updatePagination,
        updateSorting,
        updateFilters,
        resetPagination,
        getScrapeImageAdjacentIndexes,
    };
});
