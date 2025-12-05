<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useProcessedImagesStore } from '@/stores/processed-images';
import { useLabelsStore } from '@/stores/labels';
import { useRouter } from 'vue-router';
import { Dropdown, Button, Paginator, ProgressSpinner, MultiSelect } from 'primevue';
import type { PageState } from 'primevue/paginator';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';
import ImageGrid from '@/components/common/ImageGrid.vue';

const processedImagesStore = useProcessedImagesStore();
const labelsStore = useLabelsStore();
const router = useRouter();
const { t } = useI18n();

const hiddenFilterOptions = computed(() => [
    { label: t('processedImages.filter.all'), value: null },
    { label: t('processedImages.filter.hidden'), value: true },
    { label: t('processedImages.filter.notHidden'), value: false }
]);

const flaggedFilterOptions = computed(() => [
    { label: t('processedImages.filter.notSet'), value: null },
    { label: t('processedImages.filter.flagged'), value: true },
    { label: t('processedImages.filter.notFlagged'), value: false }
]);

const minimalScoreFilterOptions = computed(() => [
    { label: t('processedImages.filter.notSet'), value: null },
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 }
]);

// Fetch processed images with current pagination/sort settings
async function loadProcessedImages() {
    console.log('processedImagesStore', processedImagesStore);
    const skip = processedImagesStore.first;
    const take = processedImagesStore.rows;
    const sort = processedImagesStore.sortField && processedImagesStore.sortOrder
        ? { field: processedImagesStore.sortField, order: processedImagesStore.sortOrder }
        : undefined;
    const hidden = processedImagesStore.hiddenFilter !== null ? processedImagesStore.hiddenFilter : undefined;
    const flagged = processedImagesStore.flaggedFilter !== null ? processedImagesStore.flaggedFilter : undefined;
    const minimalScore = processedImagesStore.minimalScoreFilter ?? undefined;
    const labelIds = processedImagesStore.labelsFilter.length > 0
        ? processedImagesStore.labelsFilter.join(',')
        : undefined;

    await processedImagesStore.fetchProcessedImages(undefined, { skip, take, sort, hidden, flagged, minimalScore, labelIds });
}

// Handle pagination events
function onPage(event: PageState) {
    processedImagesStore.updatePagination(event.first, event.rows);
    loadProcessedImages();
}

// Handle filter changes
function onFilterChange() {
    // Reset to first page when filtering
    processedImagesStore.resetPagination();
    loadProcessedImages();
}

// Clear all filters
function clearFilters() {
    processedImagesStore.updateFilters(false, null, null, []); // Reset to default (not hidden, no minimal score, not flagged, no labels)
    onFilterChange();
}

// Toggle hidden state of an image
async function toggleHidden(imageId: string, currentHiddenState: boolean) {
    await processedImagesStore.updateProcessedImageHidden(imageId, !currentHiddenState);
}

// Toggle flagged state of an image
async function toggleFlagged(imageId: string, currentFlaggedState: boolean) {
    await processedImagesStore.updateProcessedImageFlagged(imageId, !currentFlaggedState);
}

function viewImageDetail(imageId: string) {
    router.push({ name: 'common_processed_image_detail', params: { id: imageId } });
}

onMounted(async () => {
    await Promise.all([loadProcessedImages(), labelsStore.fetchLabels()]);
});
</script>

<template>
    <main>
        <div class="page-container">
            <div class="header">
                <h1 class="page-title">{{ t('processedImages.title') }}</h1>
            </div>

            <div class="filters-section">
                <div class="filter-group">
                    <label class="filter-label">{{ t('processedImages.filter.label') }}</label>
                    <Dropdown
                        v-model="processedImagesStore.hiddenFilter"
                        :options="hiddenFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="onFilterChange"
                        :placeholder="t('processedImages.filter.selectStatus')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="filter-group">
                    <label class="filter-label">{{ t('processedImages.filter.flaggedStatus') }}</label>
                    <Dropdown
                        v-model="processedImagesStore.flaggedFilter"
                        :options="flaggedFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="onFilterChange"
                        :placeholder="t('processedImages.filter.notSet')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="filter-group">
                    <label class="filter-label">{{ t('processedImages.filter.minimalScore') }}</label>
                    <Dropdown
                        v-model="processedImagesStore.minimalScoreFilter"
                        :options="minimalScoreFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="onFilterChange"
                        :placeholder="t('processedImages.filter.notSet')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="filter-group">
                    <label class="filter-label">{{ t('processedImages.filter.labels') }}</label>
                    <MultiSelect
                        v-model="processedImagesStore.labelsFilter"
                        :options="labelsStore.labels"
                        optionLabel="name"
                        optionValue="id"
                        @change="onFilterChange"
                        :placeholder="t('processedImages.filter.selectLabels')"
                        class="filter-dropdown"
                        display="chip"
                    />
                </div>
                <Button
                    :label="t('processedImages.filter.clearAll')"
                    :icon="Icons.refresh"
                    severity="secondary"
                    outlined
                    @click="clearFilters"
                    class="clear-filters-button"
                />
            </div>

            <div v-if="processedImagesStore.isLoading('fetchProcessedImages')" class="loading-container">
                <ProgressSpinner />
            </div>

            <div v-else-if="processedImagesStore.processedImages.length === 0" class="empty-state">
                <p>{{ t('processedImages.empty') }}</p>
            </div>

            <ImageGrid
                v-else
                :images="processedImagesStore.processedImages"
                maxHeight="calc(100vh - 350px)"
                @image-click="viewImageDetail"
            >
                <template #overlay="{ image }">
                    <div @click.stop class="action-buttons">
                        <Button
                            :icon="image.hidden ? Icons.eyeSlash : Icons.eye"
                            :severity="image.hidden ? 'danger' : 'success'"
                            text
                            rounded
                            @click="toggleHidden(image.id, image.hidden)"
                            class="icon-button"
                            v-tooltip.bottom="t('processedImages.detail.toggleHidden')"
                        />
                        <Button
                            :icon="Icons.flag"
                            :severity="image.flagged ? 'success' : 'secondary'"
                            text
                            rounded
                            @click="toggleFlagged(image.id, image.flagged)"
                            class="icon-button"
                            v-tooltip.bottom="'Toggle Flagged Status'"
                        />
                    </div>
                </template>
            </ImageGrid>

                <Paginator
                    v-model:first="processedImagesStore.first"
                    v-model:rows="processedImagesStore.rows"
                    :totalRecords="processedImagesStore.totalProcessedImages"
                    :rowsPerPageOptions="[10, 20, 50, 100]"
                    @page="onPage"
                    class="paginator"
                />
            </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

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
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
}

.icon-button{
    background-color: var(--p-surface-50)!important;
}

.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    font-size: 1.125rem;
    color: var(--p-text-muted-color);
}

.paginator {
    margin-top: 1rem;
}
</style>
