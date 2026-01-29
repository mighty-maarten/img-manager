<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useCollectionsStore } from '@/stores/collections';
import { useLabelsStore } from '@/stores/labels';
import { DataTable, Column, Button, Chip, Dropdown, MultiSelect } from 'primevue';
import type { DataTablePageEvent, DataTableSortEvent } from 'primevue/datatable';
import { useI18n } from 'vue-i18n';
import { DateUtil } from '@/utils/date';
import { Icons } from '@/types/icons';
import { useRouter } from 'vue-router';
import { useConfirmDialog } from '@/composables/confirm-dialog';
import { useToastMessages } from '@/composables/toast';
import { useCollectionDownload } from '@/composables/collection-download';
import { CollectionService } from '@/api/services/collection';
import type { Collection, ProcessingRun } from '@/api/services/types/collection';
import { ProcessedFilter } from '@/api/services/types/collection';

const collectionsStore = useCollectionsStore();
const labelsStore = useLabelsStore();
const { t } = useI18n();
const router = useRouter();
const { confirmDelete } = useConfirmDialog();
const { successToast } = useToastMessages();
const { isDownloading, downloadCollection } = useCollectionDownload();

const tableScrollHeight = computed(() => {
    // Calculate height based on viewport, accounting for header, title, button, and padding
    // Adjust the offset (?px) based on your layout needs
    return `calc(100vh - 400px)`;
});

// Transform collections to include sortable scraped, stored and processed status
const collectionsWithScrapedStatus = computed(() => {
    return collectionsStore.collections.map((collection) => ({
        ...collection,
        isScraped: !!collection.scrape,
        isStored: collection.stored,
        isProcessed: collection.processingRuns && collection.processingRuns.length > 0,
    }));
});

const scrapedFilterOptions = ref([
    { label: t('collections.filter.notSet'), value: null },
    { label: t('collections.scrape.status.scraped'), value: true },
    { label: t('collections.scrape.status.notScraped'), value: false },
]);

const storedFilterOptions = ref([
    { label: t('collections.filter.notSet'), value: null },
    { label: t('collections.store.status.stored'), value: true },
    { label: t('collections.store.status.notStored'), value: false },
]);

const processedFilterOptions = ref([
    { label: t('collections.filter.notSet'), value: null },
    { label: t('collections.process.status.all'), value: ProcessedFilter.ALL },
    { label: t('collections.process.status.partial'), value: ProcessedFilter.PARTIAL },
    { label: t('collections.process.status.none'), value: ProcessedFilter.NONE },
]);

// Fetch collections with current pagination/sort settings
async function loadCollections() {
    const skip = collectionsStore.first;
    const take = collectionsStore.rows;
    const sort =
        collectionsStore.sortField && collectionsStore.sortOrder
            ? { field: collectionsStore.sortField, order: collectionsStore.sortOrder }
            : undefined;
    const scraped =
        collectionsStore.scrapedFilter !== null ? collectionsStore.scrapedFilter : undefined;
    const stored =
        collectionsStore.storedFilter !== null ? collectionsStore.storedFilter : undefined;
    const processed =
        collectionsStore.processedFilter !== null ? collectionsStore.processedFilter : undefined;
    const labelIds =
        collectionsStore.labelsFilter.length > 0
            ? collectionsStore.labelsFilter.join(',')
            : undefined;

    await collectionsStore.fetchCollections({
        skip,
        take,
        sort,
        scraped,
        stored,
        processed,
        labelIds,
    });
}

// Handle pagination events
function onPage(event: DataTablePageEvent) {
    collectionsStore.updatePagination(event.first, event.rows);
    loadCollections();
}

// Handle sorting events
function onSort(event: DataTableSortEvent) {
    collectionsStore.updateSorting(
        event.sortField as string | undefined,
        event.sortOrder as 1 | -1 | undefined,
    );
    loadCollections();
}

// Handle filter changes
function onFilterChange() {
    // Reset to first page when filtering
    collectionsStore.resetPagination();
    loadCollections();
}

// Clear all filters
function clearFilters() {
    collectionsStore.updateFilters(null, null, null, []);
    onFilterChange();
}

onMounted(async () => {
    await Promise.all([loadCollections(), labelsStore.fetchLabels()]);
});

function handleEdit(collection: Collection) {
    router.push({ name: 'common_collection_edit', params: { collectionId: collection.id } });
}

async function handleDelete(collection: Collection) {
    await confirmDelete(
        t('collections.delete.title'),
        t('collections.delete.description', { url: collection.url }),
        async () => {
            await collectionsStore.deleteCollection(collection.id);
            successToast(t('collections.delete.success'), '');
        },
    );
}

async function handleQuickScrape(collection: Collection) {
    await collectionsStore.scrapeCollection(collection.id, {
        sizePreset: 'medium',
        scrapingMode: 'light',
    });

    if (!collectionsStore.hasError('scrapeCollection', collection.id)) {
        successToast(t('collections.scrape.success'), '');
        // Refresh collections to update scraped status
        await loadCollections();
    }
}

async function handleStore(collection: Collection) {
    if (!collection.scrape) {
        return;
    }

    try {
        await CollectionService.storeScrape(collection.id, collection.scrape.id);
        successToast(t('collections.store.success'), '');
    } catch (error) {
        console.error('Store failed:', error);
    }
}

async function handleDownload(collection: Collection) {
    await downloadCollection(collection.id);
}

function isLabelProcessed(labelId: string, processingRuns: ProcessingRun[]): boolean {
    return processingRuns.some((run) => run.labelId === labelId);
}
</script>

<template>
    <main>
        <div class="page-container">
            <div class="header">
                <h1 class="page-title">{{ t('collections.title') }}</h1>
                <Button
                    :label="t('collections.create')"
                    @click="router.push({ name: 'common_collections_create' })"
                />
            </div>

            <div class="filters-section">
                <div class="filter-group">
                    <label class="filter-label">{{ t('collections.table.scraped') }}</label>
                    <Dropdown
                        v-model="collectionsStore.scrapedFilter"
                        :options="scrapedFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="onFilterChange"
                        :placeholder="t('collections.filter.selectStatus')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="filter-group">
                    <label class="filter-label">{{ t('collections.table.stored') }}</label>
                    <Dropdown
                        v-model="collectionsStore.storedFilter"
                        :options="storedFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="onFilterChange"
                        :placeholder="t('collections.filter.selectStatus')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="filter-group">
                    <label class="filter-label">{{ t('collections.table.processed') }}</label>
                    <Dropdown
                        v-model="collectionsStore.processedFilter"
                        :options="processedFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="onFilterChange"
                        :placeholder="t('collections.filter.selectStatus')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="filter-group">
                    <label class="filter-label">{{ t('collections.table.labels') }}</label>
                    <MultiSelect
                        v-model="collectionsStore.labelsFilter"
                        :options="labelsStore.labels"
                        optionLabel="name"
                        optionValue="id"
                        @change="onFilterChange"
                        :placeholder="t('collections.filter.selectLabels')"
                        class="filter-dropdown"
                        display="chip"
                    />
                </div>
                <Button
                    :label="t('collections.filter.clearAll')"
                    :icon="Icons.refresh"
                    severity="secondary"
                    outlined
                    @click="clearFilters"
                    class="clear-filters-button"
                />
            </div>

            <div class="table-wrapper">
                <DataTable
                    :value="collectionsWithScrapedStatus"
                    :loading="collectionsStore.isLoading('fetchCollections')"
                    striped-rows
                    scrollable
                    :scrollHeight="tableScrollHeight"
                    lazy
                    paginator
                    v-model:first="collectionsStore.first"
                    v-model:rows="collectionsStore.rows"
                    :totalRecords="collectionsStore.totalCollections"
                    :rows-per-page-options="[5, 10, 20, 50]"
                    @page="onPage"
                    @sort="onSort"
                >
                <Column field="scrape.title" :header="t('collections.table.title')" sortable>
                    <template #body="{ data }">
                        <router-link
                            :to="{
                                name: 'common_collection_detail',
                                params: { collectionId: data.id },
                            }"
                            class="clickable-url"
                        >
                            {{ data.scrape?.title || 'Unknown' }}
                        </router-link>
                    </template>
                </Column>
                <Column field="labels" :header="t('collections.table.labels')">
                    <template #body="{ data }">
                        <div v-if="data.labels && data.labels.length > 0" class="label-chips-container">
                            <Chip
                                v-for="label in data.labels"
                                :key="label.id"
                                :label="label.name"
                                :class="
                                    isLabelProcessed(label.id, data.processingRuns)
                                        ? 'label-chip-processed'
                                        : 'label-chip-unprocessed'
                                "
                            />
                        </div>
                        <span v-else class="empty-value">-</span>
                    </template>
                </Column>
                <Column
                    field="scrape.id"
                    sortField="isScraped"
                    :header="t('collections.table.scraped')"
                >
                    <template #body="{ data }">
                        <Chip
                            :label="
                                data.isScraped
                                    ? t('collections.scrape.status.scraped')
                                    : t('collections.scrape.status.notScraped')
                            "
                            :class="
                                data.isScraped ? 'scraped-chip' : 'not-scraped-chip clickable-chip'
                            "
                            @click="!data.isScraped ? handleQuickScrape(data) : null"
                            v-tooltip.top="!data.isScraped ? t('collections.scrape.tooltip') : ''"
                        />
                    </template>
                </Column>
                <Column field="stored" sortField="isStored" :header="t('collections.table.stored')">
                    <template #body="{ data }">
                        <Chip
                            :label="
                                data.stored
                                    ? t('collections.store.status.stored')
                                    : t('collections.store.status.notStored')
                            "
                            :class="data.stored ? 'stored-chip' : 'not-stored-chip clickable-chip'"
                            @click="!data.stored && data.isScraped ? handleStore(data) : null"
                            v-tooltip.top="
                                !data.stored && data.isScraped ? t('collections.store.tooltip') : ''
                            "
                        />
                    </template>
                </Column>
                <Column field="createdOn" :header="t('collections.table.createdOn')" sortable>
                    <template #body="{ data }">
                        {{ DateUtil.formatDateTime(data.createdOn) }}
                    </template>
                </Column>
                <Column :header="t('collections.table.actions')">
                    <template #body="{ data }">
                        <div class="action-buttons">
                            <Button
                                v-if="data.stored"
                                :icon="Icons.download"
                                severity="success"
                                text
                                rounded
                                @click="handleDownload(data)"
                                :loading="isDownloading"
                                :disabled="isDownloading"
                            />
                            <Button
                                :icon="Icons.edit"
                                severity="secondary"
                                text
                                rounded
                                @click="handleEdit(data)"
                            />
                            <Button
                                :icon="Icons.delete"
                                severity="danger"
                                text
                                rounded
                                @click="handleDelete(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

.table-wrapper {
    width: 100%;
    overflow-x: auto;

    // Enable smooth scrolling on touch devices
    -webkit-overflow-scrolling: touch;

    // Responsive: ensure horizontal scrolling on tablets and smaller
    @media (max-width: 1024px) {
        overflow-x: auto;
    }
}

.filters-section {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background-color: var(--p-surface-50);
    border-radius: var(--p-border-radius);
    border: 1px solid var(--p-surface-200);
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    max-width: 250px;

    @media (max-width: 768px) {
        max-width: none;
    }
}

.filter-label {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--p-text-color);
}

.filter-dropdown {
    width: 100%;
}

.clear-filters-button {
    align-self: flex-end;

    @media (max-width: 768px) {
        width: 100%;
        align-self: stretch;
    }
}

.empty-value {
    color: var(--p-text-muted-color);
    font-style: italic;
}

.label-chips-container {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.label-chip-processed {
    background-color: var(--p-purple-500);
    color: white;
}

.label-chip-unprocessed {
    background-color: var(--p-surface-300);
    color: var(--p-text-color);
}

.scraped-chip {
    background-color: var(--p-green-500);
    color: white;
    cursor: default;
}

.not-scraped-chip {
    background-color: var(--p-surface-300);
    color: var(--p-text-color);
}

.stored-chip {
    background-color: var(--p-blue-500);
    color: white;
    cursor: default;
}

.not-stored-chip {
    background-color: var(--p-surface-300);
    color: var(--p-text-color);
}

.clickable-url {
    color: var(--p-primary-color);
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
        color: var(--p-primary-600);
        text-decoration: underline;
    }
}

.clickable-chip {
    cursor: pointer;
    transition:
        opacity 0.2s ease,
        transform 0.1s ease;

    &:hover {
        opacity: 0.85;
        transform: scale(1.05);
    }

    &:active {
        transform: scale(0.98);
    }
}

.action-buttons {
    display: flex;
    justify-content: flex-end;
}
</style>
