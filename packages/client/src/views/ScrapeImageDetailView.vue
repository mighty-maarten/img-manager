<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCollectionsStore } from '@/stores/collections';
import { Button, ProgressSpinner } from 'primevue';
import { useI18n } from 'vue-i18n';
import ImageViewer from '@/components/common/ImageViewer.vue';
import ImageDetailHeader from '@/components/common/ImageDetailHeader.vue';
import { useImageNavigation } from '@/composables/image-navigation';

const route = useRoute();
const router = useRouter();
const collectionsStore = useCollectionsStore();
const { t } = useI18n();

const imageViewerRef = ref<InstanceType<typeof ImageViewer> | null>(null);
const imageContainerRef = ref<HTMLElement | null>(null);
const isImageZoomed = ref(false);

const collectionId = computed(() => route.params.collectionId as string);
const scrapeId = computed(() => route.params.scrapeId as string);
const imageIndex = computed(() => parseInt(route.params.imageIndex as string, 10));

const currentScrapeResult = computed(() => collectionsStore.currentScrapeResult);
const currentImage = computed(() => {
    const index = imageIndex.value;
    if (!currentScrapeResult.value || index < 0 || index >= currentScrapeResult.value.images.length) {
        return null;
    }
    return currentScrapeResult.value.images[index];
});

const isLoading = computed(() =>
    collectionsStore.isLoading('fetchScrapeResult', collectionId.value)
);
const hasError = computed(() =>
    collectionsStore.hasError('fetchScrapeResult', collectionId.value)
);

const adjacentIndexes = ref<{ prevIndex: number | null; nextIndex: number | null }>({
    prevIndex: null,
    nextIndex: null
});

async function loadScrapeResult() {
    await collectionsStore.fetchScrapeResult(collectionId.value, scrapeId.value);
    // Get adjacent image indexes for navigation
    adjacentIndexes.value = collectionsStore.getScrapeImageAdjacentIndexes(imageIndex.value);
}

function navigateToPrevious() {
    if (adjacentIndexes.value.prevIndex !== null) {
        router.push({
            name: 'common_scrape_image_detail',
            params: {
                collectionId: collectionId.value,
                scrapeId: scrapeId.value,
                imageIndex: adjacentIndexes.value.prevIndex.toString()
            }
        });
    }
}

function navigateToNext() {
    if (adjacentIndexes.value.nextIndex !== null) {
        router.push({
            name: 'common_scrape_image_detail',
            params: {
                collectionId: collectionId.value,
                scrapeId: scrapeId.value,
                imageIndex: adjacentIndexes.value.nextIndex.toString()
            }
        });
    }
}

function goBack() {
    // Navigate back to collection detail view
    router.push({
        name: 'common_collection_detail',
        params: { collectionId: collectionId.value }
    });
}

// Setup image navigation with keyboard and touch/swipe
const { attachTouchListeners } = useImageNavigation(
    {
        onPrevious: navigateToPrevious,
        onNext: navigateToNext,
        onClose: goBack
    },
    {
        containerRef: imageContainerRef,
        disableSwipeWhenZoomed: isImageZoomed
    }
);

onMounted(async () => {
    await loadScrapeResult();
});

// Watch for imageViewerRef to become available and sync refs
import { watch } from 'vue';
watch(imageViewerRef, (viewer) => {
    if (viewer) {
        // Sync the container ref
        imageContainerRef.value = viewer.containerRef;

        // Sync the zoom state
        isImageZoomed.value = viewer.isActualSize;

        // Attach touch listeners once container is available
        if (imageContainerRef.value) {
            attachTouchListeners();
        }
    }
}, { immediate: true });

// Watch for zoom state changes
watch(() => imageViewerRef.value?.isActualSize, (zoomed) => {
    if (zoomed !== undefined) {
        isImageZoomed.value = zoomed;
    }
});

// Watch for route changes (when navigating to different image)
watch(() => route.params.imageIndex, async (newIndex) => {
    if (newIndex !== undefined) {
        // Reset zoom when changing images
        imageViewerRef.value?.resetZoom();
        // Update adjacent indexes
        adjacentIndexes.value = collectionsStore.getScrapeImageAdjacentIndexes(parseInt(newIndex as string, 10));
    }
});
</script>

<template>
    <main>
        <div class="page-container">
            <!-- Simple Header -->
            <ImageDetailHeader
                v-if="currentImage"
                :title="currentImage.filename"
                @close="goBack"
            />

            <!-- Loading State -->
            <div v-if="isLoading" class="loading-container">
                <ProgressSpinner />
            </div>

            <!-- Error State -->
            <div v-else-if="hasError || !currentImage" class="error-state">
                <p>{{ t('processedImages.detail.notFound') }}</p>
                <Button :label="t('processedImages.detail.back')" @click="goBack" />
            </div>

            <!-- Image Display -->
            <ImageViewer
                v-else-if="currentImage"
                ref="imageViewerRef"
                :image-url="currentImage.url"
                :image-alt="currentImage.filename"
            />

        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

// Override common styles for full-page modal layout
main {
    padding: 0;
    height: 100vh;
}

.page-container {
    gap: 0;
    height: 100%;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 50px);
}

.error-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    min-height: calc(100vh - 50px);
    font-size: 1.125rem;
    color: var(--p-text-muted-color);
}
</style>
