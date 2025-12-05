<script setup lang="ts">
import { ref } from 'vue';

interface ImageViewerProps {
    imageUrl: string;
    imageAlt: string;
}

const props = defineProps<ImageViewerProps>();

const containerRef = ref<HTMLElement | null>(null);
const isActualSize = ref(false);
const imageNeedsZoom = ref(false);

function toggleZoom() {
    isActualSize.value = !isActualSize.value;
}

function handleImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    // Check if image is larger than the container size (accounting for padding and max height)
    const maxHeight = window.innerHeight - 50; // Same as CSS calc(100vh - 50px)
    const maxWidth = img.parentElement?.clientWidth || window.innerWidth;

    imageNeedsZoom.value = img.naturalWidth > maxWidth || img.naturalHeight > maxHeight;
}

defineExpose({
    resetZoom: () => {
        isActualSize.value = false;
        imageNeedsZoom.value = false;
    },
    containerRef,
    isActualSize
});
</script>

<template>
    <div ref="containerRef" class="image-viewer-container">
        <div class="image-wrapper" :class="{ 'actual-size': isActualSize }">
            <img
                :src="imageUrl"
                :alt="imageAlt"
                :class="{
                    'image-fit': !isActualSize,
                    'image-actual': isActualSize,
                    'image-zoomable': !isActualSize && imageNeedsZoom,
                    'image-zoomed': isActualSize && imageNeedsZoom
                }"
                @load="handleImageLoad"
                @click="imageNeedsZoom && toggleZoom()"
            />
        </div>
    </div>
</template>

<style scoped lang="scss">
.image-viewer-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 0;
    background-color: transparent;
    border-radius: 0;
    border: none;
    min-height: calc(100vh - 50px);
    touch-action: pan-y; // Allow vertical scrolling while enabling horizontal swipe detection
}

.image-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 1rem;

    &.actual-size {
        overflow: auto;
        max-height: calc(100vh - 50px);
    }
}

.image-fit {
    max-width: 100%;
    max-height: calc(100vh - 50px);
    width: auto;
    height: auto;
    object-fit: contain;
}

.image-actual {
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
}

.image-zoomable {
    cursor: zoom-in;
}

.image-zoomed {
    cursor: zoom-out;
}
</style>
