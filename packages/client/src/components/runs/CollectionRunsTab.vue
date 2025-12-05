<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProcessedImagesStore } from '@/stores/processed-images';
import { Select, Dropdown, ProgressSpinner, Button } from 'primevue';
import { useI18n } from 'vue-i18n';
import type { ProcessingRun } from '@/api/services/types/collection';
import { DateUtil } from '@/utils/date';
import { Icons } from '@/types/icons';
import ImageGrid from '@/components/common/ImageGrid.vue';

const props = defineProps<{
    collectionId: string;
    processingRuns: ProcessingRun[];
}>();

const processedImagesStore = useProcessedImagesStore();
const router = useRouter();
const { t } = useI18n();

const selectedRunId = ref<string | null>(null);
const hiddenFilter = ref<boolean | null>(false);
const flaggedFilter = ref<boolean | null>(false);
const localProcessedImages = ref<any[]>([]);
const localTotalImages = ref<number>(0);
const isLoading = ref(false);

// Transform processing runs for the dropdown
const runOptions = computed(() => {
    return props.processingRuns.map(run => ({
        label: `${run.labelName} - ${DateUtil.formatDateTime(run.createdOn)}`,
        value: run.id
    }));
});

// Filter options for hidden state
const hiddenFilterOptions = computed(() => [
    { label: t('processedImages.filter.all'), value: null },
    { label: t('processedImages.filter.hidden'), value: true },
    { label: t('processedImages.filter.notHidden'), value: false }
]);

// Filter options for flagged state
const flaggedFilterOptions = computed(() => [
    { label: t('processedImages.filter.notSet'), value: null },
    { label: t('processedImages.filter.flagged'), value: true },
    { label: t('processedImages.filter.notFlagged'), value: false }
]);

// Filtered images based on hidden and flagged filters
const filteredImages = computed(() => {
    let filtered = localProcessedImages.value;

    // Apply hidden filter
    if (hiddenFilter.value !== null) {
        filtered = filtered.filter(image => image.hidden === hiddenFilter.value);
    }

    // Apply flagged filter
    if (flaggedFilter.value !== null) {
        filtered = filtered.filter(image => image.flagged === flaggedFilter.value);
    }

    return filtered;
});

// Select the first run by default if available
onMounted(() => {
    if (props.processingRuns.length > 0) {
        selectedRunId.value = props.processingRuns[0].id;
    }
});

// Watch for run selection changes and fetch images
watch(selectedRunId, async (newRunId) => {
    if (newRunId) {
        await fetchProcessedImages(newRunId);
    }
}, { immediate: true });

async function fetchProcessedImages(runId: string) {
    isLoading.value = true;
    try {
        await processedImagesStore.fetchProcessedImages(runId);
        localProcessedImages.value = [...processedImagesStore.processedImages];
        localTotalImages.value = processedImagesStore.totalProcessedImages;
    } finally {
        isLoading.value = false;
    }
}

function viewImageDetail(imageId: string) {
    router.push({
        name: 'common_processed_image_detail',
        params: { id: imageId },
        query: {
            collectionId: props.collectionId,
            source: 'collection_runs'
        }
    });
}

// Toggle hidden state of an image
async function toggleHidden(imageId: string, currentHiddenState: boolean) {
    await processedImagesStore.updateProcessedImageHidden(imageId, !currentHiddenState);
    // Refresh the images after updating
    if (selectedRunId.value) {
        await fetchProcessedImages(selectedRunId.value);
    }
}

// Toggle flagged state of an image
async function toggleFlagged(imageId: string, currentFlaggedState: boolean) {
    await processedImagesStore.updateProcessedImageFlagged(imageId, !currentFlaggedState);
    // Refresh the images after updating
    if (selectedRunId.value) {
        await fetchProcessedImages(selectedRunId.value);
    }
}
</script>

<template>
    <div class="runs-tab-container">
        <div v-if="processingRuns.length === 0" class="no-runs">
            <p>{{ t('collections.runs.noRuns') }}</p>
        </div>

        <div class="runs" v-else>
            <div class="run-selector">
                <div class="form-field">
                    <label for="runSelect">{{ t('collections.runs.selectRun') }}</label>
                    <Select
                        id="runSelect"
                        v-model="selectedRunId"
                        :options="runOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="isLoading"
                        class="run-select"
                    />
                </div>
                <div class="form-field">
                    <label for="hiddenFilter">{{ t('processedImages.filter.label') }}</label>
                    <Dropdown
                        id="hiddenFilter"
                        v-model="hiddenFilter"
                        :options="hiddenFilterOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('processedImages.filter.selectStatus')"
                        class="filter-dropdown"
                    />
                </div>
                <div class="form-field">
                    <label for="flaggedFilter">{{ t('processedImages.filter.flaggedStatus') }}</label>
                    <Dropdown
                        id="flaggedFilter"
                        v-model="flaggedFilter"
                        :options="flaggedFilterOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('processedImages.filter.notSet')"
                        class="filter-dropdown"
                    />
                </div>
            </div>

            <div v-if="isLoading" class="loading-container">
                <ProgressSpinner />
            </div>

            <div v-else-if="selectedRunId" class="results-section">
                <div class="results-summary">
                    <div class="results-title">
                        <h2>{{ t('collections.runs.imagesCount') }}</h2>
                        <h3>({{ filteredImages.length }}{{ (hiddenFilter !== null || flaggedFilter !== null) ? ` / ${localTotalImages}` : '' }})</h3>
                    </div>
                </div>

                <div v-if="filteredImages.length === 0" class="no-images">
                    <p>{{ t('collections.runs.noImages') }}</p>
                </div>

                <ImageGrid
                    :images="filteredImages"
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
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

.runs-tab-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.runs{
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.no-runs,
.no-images {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    font-size: 1.125rem;
    color: var(--p-text-muted-color);
}

.run-selector {
    display: flex;
    gap: 1rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    max-width: 400px;

    label {
        font-weight: 600;
        color: var(--p-text-color);
    }
}

.run-select,
.filter-dropdown {
    width: 100%;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
}

.results-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.results-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--p-surface-0);
    border-radius: var(--p-border-radius-md);
    padding: 1rem 0;
}

.results-title {
    display: flex;
    gap: 2rem;
    align-items: center;

    h2 {
        font-size: 1.5rem;
        color: var(--p-text-color);
        margin: 0;
    }

    h3 {
        font-size: 1rem;
        color: var(--p-text-muted-color);
        margin: 0;
    }
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
}

.icon-button {
    background-color: var(--p-surface-50)!important;
}
</style>
