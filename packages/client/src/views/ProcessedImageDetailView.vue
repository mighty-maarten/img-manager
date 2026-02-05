<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProcessedImagesStore } from '@/stores/processed-images';
import { Button, ProgressSpinner, Rating } from 'primevue';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';
import ImageViewer from '@/components/common/ImageViewer.vue';
import ImageDetailHeader from '@/components/common/ImageDetailHeader.vue';
import { useImageNavigation } from '@/composables/image-navigation';

const route = useRoute();
const router = useRouter();
const processedImagesStore = useProcessedImagesStore();
const { t } = useI18n();

const imageViewerRef = ref<InstanceType<typeof ImageViewer> | null>(null);
const adjacentIds = ref<{ prevId: string | null; nextId: string | null }>({ prevId: null, nextId: null });
const imageContainerRef = ref<HTMLElement | null>(null);
const isImageZoomed = ref(false);

const imageId = computed(() => route.params.id as string);
const currentImage = computed(() => processedImagesStore.currentImage);
const isLoading = computed(() => processedImagesStore.isLoading('fetchProcessedImage', imageId.value));
const hasError = computed(() => processedImagesStore.hasError('fetchProcessedImage', imageId.value));

async function loadImage() {
    await processedImagesStore.fetchProcessedImage(imageId.value);
    // Get adjacent image IDs for navigation
    adjacentIds.value = processedImagesStore.getAdjacentImageIds(imageId.value);
}

async function toggleHidden() {
    if (!currentImage.value) return;

    await processedImagesStore.updateProcessedImageHidden(
        currentImage.value.id,
        !currentImage.value.hidden
    );
    // Refresh the current image to get updated state
    await processedImagesStore.fetchProcessedImage(imageId.value);
}

async function toggleFlagged() {
    if (!currentImage.value) return;

    await processedImagesStore.updateProcessedImageFlagged(
        currentImage.value.id,
        !currentImage.value.flagged
    );
    // Refresh the current image to get updated state
    await processedImagesStore.fetchProcessedImage(imageId.value);
}

async function updateScore(newScore: number | null) {
    if (!currentImage.value) return;

    await processedImagesStore.updateProcessedImageScore(
        currentImage.value.id,
        newScore
    );
}

function navigateToPrevious() {
    if (adjacentIds.value.prevId) {
        router.push({
            name: 'common_processed_image_detail',
            params: { id: adjacentIds.value.prevId },
            query: route.query // Preserve query params (collectionId, source)
        });
    }
}

function navigateToNext() {
    if (adjacentIds.value.nextId) {
        router.push({
            name: 'common_processed_image_detail',
            params: { id: adjacentIds.value.nextId },
            query: route.query // Preserve query params (collectionId, source)
        });
    }
}

function goBack() {
    // Check if we came from a collection's runs tab
    const collectionId = route.query.collectionId as string | undefined;
    const source = route.query.source as string | undefined;

    if (source === 'collection_runs' && collectionId) {
        router.push({ name: 'common_collection_detail', params: { collectionId } });
    } else {
        router.push({ name: 'common_processed_images' });
    }
}

// Keyboard shortcuts for processed image specific actions (h, f)
function handleProcessedImageKeydown(event: KeyboardEvent) {
    switch (event.key) {
        case 'h':
        case 'H':
            toggleHidden();
            break;
        case 'f':
        case 'F':
            toggleFlagged();
            break;
    }
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
    await loadImage();
    // Add keyboard listener for processed-image-specific shortcuts (h, f)
    window.addEventListener('keydown', handleProcessedImageKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleProcessedImageKeydown);
});

// Watch for imageViewerRef to become available and sync refs
import { watch } from 'vue';
watch(imageViewerRef, (viewer) => {
    if (viewer) {
        // Sync the container ref
        const container = viewer.containerRef;
        imageContainerRef.value = container;

        // Sync the zoom state
        const zoomed = viewer.isActualSize;
        isImageZoomed.value = zoomed;

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
watch(() => route.params.id, async (newId) => {
    if (newId) {
        // Reset zoom when changing images
        imageViewerRef.value?.resetZoom();
        await loadImage();
    }
});
</script>

<template>
    <main>
        <div class="page-container">
            <!-- Header with processed image actions -->
            <ImageDetailHeader
                v-if="currentImage"
                :title="currentImage.filename"
                @close="goBack"
            >
                <template #actions>
                    <div class="rating-compact" v-tooltip.bottom="t('processedImages.detail.setScore')">
                        <Rating
                            :modelValue="currentImage.score ?? undefined"
                            @update:modelValue="updateScore"
                            :cancel="true"
                            :stars="5"
                        />
                    </div>
                    <Button
                        :icon="currentImage.hidden ? Icons.eyeSlash : Icons.eye"
                        :severity="currentImage.hidden ? 'danger' : 'success'"
                        text
                        rounded
                        @click="toggleHidden"
                        class="icon-button"
                        v-tooltip.bottom="t('processedImages.detail.toggleHidden')"
                    />
                    <Button
                        :icon="currentImage.flagged ? Icons.flagFill : Icons.flag"
                        :severity="currentImage.flagged ? 'warning' : 'secondary'"
                        text
                        rounded
                        @click="toggleFlagged"
                        class="icon-button"
                        v-tooltip.bottom="'Toggle Flagged Status'"
                    />
                </template>
            </ImageDetailHeader>

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
                v-else
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

.rating-compact {
    display: flex;
    align-items: center;
    transform-origin: center;
}

.icon-button {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
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

// Responsive adjustments for smaller screens/tablets
@media (max-width: 768px) {
    .rating-compact {
        transform: scale(0.75);
    }
}
</style>
