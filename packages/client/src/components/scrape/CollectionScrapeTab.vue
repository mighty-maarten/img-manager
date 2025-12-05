<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCollectionsStore } from '@/stores/collections';
import { useToastMessages } from '@/composables/toast';
import { Button, Select, Card, Chip } from 'primevue';
import { useI18n } from 'vue-i18n';
import type { ScrapeResult } from '@/api/services/types/collection';
import ImageGrid from '@/components/common/ImageGrid.vue';

const props = defineProps<{
    collectionId: string;
    initialScrapeId?: string;
}>();

const router = useRouter();
const collectionsStore = useCollectionsStore();
const { successToast, errorToast } = useToastMessages();
const { t } = useI18n();

const scrapeResult = ref<ScrapeResult | null>(null);
const showResults = ref(false);
const isNewScrape = ref(false); // Track if results are from a new scrape vs loaded on mount

// Form fields
const sizePreset = ref('medium');
const scrapingMode = ref('heavy');

const sizePresetOptions = [
    { label: t('collections.scrape.presets.all'), value: 'all' },
    { label: t('collections.scrape.presets.small'), value: 'small' },
    { label: t('collections.scrape.presets.medium'), value: 'medium' },
    { label: t('collections.scrape.presets.large'), value: 'large' },
];

const scrapingModeOptions = [
    { label: t('collections.scrape.modes.light'), value: 'light' },
    { label: t('collections.scrape.modes.heavy'), value: 'heavy' },
];

onMounted(async () => {
    // Fetch existing scrape results if scrapeId exists
    if (props.initialScrapeId) {
        const result = await collectionsStore.fetchScrapeResult(
            props.collectionId,
            props.initialScrapeId,
        );
        if (!collectionsStore.hasError('fetchScrapeResult', props.collectionId) && result) {
            scrapeResult.value = result;
            showResults.value = true;
            isNewScrape.value = false;
        }
    }
});

async function handleSubmit() {
    const result = await collectionsStore.scrapeCollection(props.collectionId, {
        sizePreset: sizePreset.value,
        scrapingMode: scrapingMode.value,
    });

    if (!collectionsStore.hasError('scrapeCollection', props.collectionId)) {
        scrapeResult.value = result;
        showResults.value = true;
        isNewScrape.value = true;
        successToast(t('collections.scrape.success'), '');
    } else {
        errorToast(t('collections.scrape.error'), '');
    }
}

function handleImageClick(imageId: string) {
    if (!scrapeResult.value || !props.initialScrapeId) return;

    const imageIndex = scrapeResult.value.images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return;

    router.push({
        name: 'common_scrape_image_detail',
        params: {
            collectionId: props.collectionId,
            scrapeId: props.initialScrapeId,
            imageIndex: imageIndex.toString()
        }
    });
}
</script>

<template>
    <div class="scrape-tab-container">
        <form @submit.prevent="handleSubmit" class="scrape-form">
            <div class="form-row-full">
                <div class="form-field">
                    <label for="sizePreset">{{ t('collections.scrape.sizePreset') }}</label>
                    <Select
                        id="sizePreset"
                        v-model="sizePreset"
                        :options="sizePresetOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="collectionsStore.isLoading('scrapeCollection', collectionId)"
                    />
                </div>

                <div class="form-field">
                    <label for="scrapingMode">{{ t('collections.scrape.scrapingMode') }}</label>
                    <Select
                        id="scrapingMode"
                        v-model="scrapingMode"
                        :options="scrapingModeOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="collectionsStore.isLoading('scrapeCollection', collectionId)"
                    />
                </div>

                <div class="form-field button-field">
                    <label>&nbsp;</label>
                    <Button
                        type="submit"
                        :label="t('collections.scrape.scrape')"
                        :loading="collectionsStore.isLoading('scrapeCollection', collectionId)"
                    />
                </div>
            </div>
        </form>

        <div v-if="showResults && scrapeResult" class="results-section">
            <div
                v-if="
                    scrapeResult.tags?.length ||
                    scrapeResult.categories?.length ||
                    scrapeResult.models?.length
                "
                class="metadata-section"
            >
                <Card class="metadata-card">
                    <template #content>
                        <div class="metadata-groups">
                            <div v-if="scrapeResult.models?.length" class="metadata-group">
                                <h3 class="metadata-title">Models</h3>
                                <div class="chip-container">
                                    <Chip
                                        v-for="model in scrapeResult.models"
                                        :key="model"
                                        :label="model"
                                    />
                                </div>
                            </div>

                            <div v-if="scrapeResult.categories?.length" class="metadata-group">
                                <h3 class="metadata-title">Categories</h3>
                                <div class="chip-container">
                                    <Chip
                                        v-for="category in scrapeResult.categories"
                                        :key="category"
                                        :label="category"
                                    />
                                </div>
                            </div>

                            <div v-if="scrapeResult.tags?.length" class="metadata-group">
                                <h3 class="metadata-title">Tags</h3>
                                <div class="chip-container">
                                    <Chip
                                        v-for="tag in scrapeResult.tags"
                                        :key="tag"
                                        :label="tag"
                                    />
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <div class="results-summary">
                <div class="results-title">
                    <h2>Scrape Results</h2>
                    <h3>({{ scrapeResult.images.length }})</h3>
                </div>
            </div>

            <ImageGrid
                :images="scrapeResult.images"
                :clickable="true"
                max-height="calc(100vh - 400px)"
                column-max-width="1fr"
                padding="2px 1rem"
                @image-click="handleImageClick"
            />

            <div v-if="scrapeResult.errors && scrapeResult.errors.length > 0" class="errors-section">
                <h3>Errors</h3>
                <div v-for="(error, index) in scrapeResult.errors" :key="index" class="error-item">
                    <strong>{{ error.url }}:</strong> {{ error.error }}
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';
.scrape-tab-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.scrape-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.form-row-full {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 1rem;
    align-items: start;
}

.button-field {
    label {
        visibility: hidden;
    }
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

.metadata-section {
    width: 100%;
}

.metadata-card {
    width: 100%;
}

.metadata-groups {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.metadata-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.metadata-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.chip-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.errors-section {
    background: var(--p-surface-0);
    border-radius: var(--p-border-radius-md);
    padding: 1.5rem;
    border-left: 4px solid var(--p-red-500);

    h3 {
        margin: 0 0 1rem 0;
        color: var(--p-red-500);
    }
}

.error-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--p-surface-200);

    &:last-child {
        border-bottom: none;
    }

    strong {
        color: var(--p-text-color);
    }
}
</style>
