<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCollectionsStore } from '@/stores/collections';
import { useToastMessages } from '@/composables/toast';
import { Button, Card, Chip, TabView, TabPanel } from 'primevue';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';
import type { Collection } from '@/api/services/types/collection';
import CollectionScrapeTab from '@/components/scrape/CollectionScrapeTab.vue';
import CollectionRunsTab from '@/components/runs/CollectionRunsTab.vue';

const route = useRoute();
const router = useRouter();
const collectionsStore = useCollectionsStore();
const { errorToast } = useToastMessages();
const { t } = useI18n();

const collectionId = route.params.collectionId as string;
const collection = ref<Collection | null>(null);

onMounted(async () => {
    // Try to find collection in store first
    collection.value = collectionsStore.collections.find((c) => c.id === collectionId) ?? null;

    // If not in store, fetch from API
    if (!collection.value) {
        collection.value = await collectionsStore.fetchCollection(collectionId);
    }

    if (!collection.value) {
        errorToast(t('collections.edit.notFound'), '');
        router.push({ name: 'common_collections' });
        return;
    }
});

function handleBack() {
    router.push({ name: 'common_collections' });
}

const isScraped = computed(() => {
    return !!collection.value?.scrape;
});

const hasProcessingRuns = computed(() => {
    return !!collection.value?.processingRuns && collection.value.processingRuns.length > 0;
});

const hasMetadata = computed(() => {
    const scrape = collection.value?.scrape;
    return scrape?.tags?.length || scrape?.categories?.length || scrape?.models?.length;
});
</script>

<template>
    <main>
        <div class="page-container">
            <div class="header">
                <div class="header-title">
                    <Button
                        :icon="Icons.arrowLeft"
                        severity="secondary"
                        text
                        rounded
                        @click="handleBack"
                        class="back-button"
                    />
                    <h1 class="page-title">{{ t('collections.detail.title') }}</h1>
                    <div class="header-meta">
                        <h3 class="collection-url">{{ collection?.scrape?.title||collection?.url }}</h3>
                        <Chip
                            v-if="collection"
                            :label="isScraped ? t('collections.scrape.status.scrapedLong') : t('collections.scrape.status.notScrapedLong')"
                            :class="isScraped ? 'scraped-chip' : 'not-scraped-chip'"
                        />
                    </div>
                </div>
            </div>

            <div v-if="collection?.scrape && hasMetadata" class="metadata-section">
                <Card class="metadata-card">
                    <template #content>
                        <div class="metadata-groups">
                            <div v-if="collection.scrape.models?.length" class="metadata-group">
                                <h3 class="metadata-title">Models</h3>
                                <div class="chip-container">
                                    <Chip
                                        v-for="model in collection.scrape.models"
                                        :key="model"
                                        :label="model"
                                    />
                                </div>
                            </div>
                            <div v-if="collection.scrape.categories?.length" class="metadata-group">
                                <h3 class="metadata-title">Categories</h3>
                                <div class="chip-container">
                                    <Chip
                                        v-for="category in collection.scrape.categories"
                                        :key="category"
                                        :label="category"
                                    />
                                </div>
                            </div>
                            <div v-if="collection.scrape.tags?.length" class="metadata-group">
                                <h3 class="metadata-title">Tags</h3>
                                <div class="chip-container">
                                    <Chip
                                        v-for="tag in collection.scrape.tags"
                                        :key="tag"
                                        :label="tag"
                                    />
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <div v-if="collection" class="tabs-container">
                <TabView>
                    <TabPanel
                        v-if="hasProcessingRuns"
                        :header="t('collections.detail.tabs.runs')"
                        value="runs"
                    >
                        <CollectionRunsTab
                            :collection-id="collectionId"
                            :processing-runs="collection.processingRuns"
                        />
                    </TabPanel>
                    <TabPanel :header="t('collections.detail.tabs.scrape')" value="scrape">
                        <CollectionScrapeTab
                            :collection-id="collectionId"
                            :initial-scrape-id="collection.scrape?.id"
                        />
                    </TabPanel>
                </TabView>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

.tabs-container {
    max-width: unset;
    width: 100%;
}

.header-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-left: 2rem;
}

.collection-url {
    font-size: 1rem;
    color: var(--p-text-muted-color);
    margin: 0;
}

.scraped-chip {
    background-color: var(--p-green-500);
    color: white;
}

.not-scraped-chip {
    background-color: var(--p-surface-300);
    color: var(--p-text-color);
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
</style>
