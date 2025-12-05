<script setup lang="ts">
import ImageCard from '@/components/common/ImageCard.vue';

interface ImageGridProps {
    images: any[];
    clickable?: boolean;
    maxHeight?: string;
    columnMinWidth?: number;
    columnMaxWidth?: string;
    padding?: string;
}

const props = withDefaults(defineProps<ImageGridProps>(), {
    clickable: true,
    maxHeight: '65vh',
    columnMinWidth: 250,
    columnMaxWidth: '300px',
    padding: '1rem'
});

const emit = defineEmits<{
    (e: 'image-click', imageId: string): void;
}>();

const gridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(${props.columnMinWidth}px, ${props.columnMaxWidth}))`,
    maxHeight: props.maxHeight,
    padding: props.padding
};

function handleImageClick(imageId: string) {
    if (props.clickable) {
        emit('image-click', imageId);
    }
}
</script>

<template>
    <div class="image-grid" :style="gridStyle">
        <ImageCard
            v-for="image in images"
            :key="image.id"
            :image="image"
            :clickable="clickable"
            @click="handleImageClick"
        >
            <template v-if="$slots.overlay" #overlay>
                <slot name="overlay" :image="image"></slot>
            </template>
            <template v-if="$slots.footer" #footer>
                <slot name="footer" :image="image"></slot>
            </template>
        </ImageCard>
    </div>
</template>

<style scoped lang="scss">
.image-grid {
    display: grid;
    grid-auto-rows: max-content;
    gap: 1.5rem;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
}
</style>
