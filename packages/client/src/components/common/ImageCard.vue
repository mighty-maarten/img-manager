<script setup lang="ts">
import { computed } from 'vue';
import { DateUtil } from '@/utils/date';

interface ImageData {
    id: string;
    url?: string;
    filename: string;
    createdOn?: string | Date;
    width?: number;
    height?: number;
    fileSize?: number;
    [key: string]: any;
}

interface Props {
    image: ImageData;
    clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    clickable: true
});

const emit = defineEmits<{
    click: [imageId: string];
}>();

const formattedDate = computed(() => {
    if (!props.image.createdOn) return null;
    return DateUtil.formatDateTime(props.image.createdOn);
});

const dimensions = computed(() => {
    if (props.image.width && props.image.height) {
        return `${props.image.width}x${props.image.height}`;
    }
    return null;
});

const formattedFileSize = computed(() => {
    if (!props.image.fileSize) return null;
    const bytes = props.image.fileSize;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
});

const compactMetadata = computed(() => {
    const parts: string[] = [];
    if (dimensions.value) parts.push(dimensions.value);
    if (formattedFileSize.value) parts.push(formattedFileSize.value);
    return parts.length > 0 ? parts.join(' • ') : null;
});

function handleClick() {
    if (props.clickable) {
        emit('click', props.image.id);
    }
}
</script>

<template>
    <div class="image-card" :class="{ clickable }">
        <div class="image-wrapper" @click="handleClick">
            <img
                v-if="image.url"
                :src="image.url"
                :alt="image.filename"
                class="image"
            />
            <div v-else class="no-image">
                <i class="pi pi-image"></i>
            </div>
            <div v-if="$slots.overlay" class="image-overlay">
                <slot name="overlay" />
            </div>
        </div>
        <div class="image-info">
            <p class="image-filename" :title="image.filename">{{ image.filename }}</p>
            <p v-if="formattedDate" class="image-date">{{ formattedDate }}</p>
            <p v-if="compactMetadata" class="image-metadata">{{ compactMetadata }}</p>
            <slot name="footer" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.image-card {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--p-surface-200);
    border-radius: var(--p-border-radius);
    overflow: hidden;
    background-color: var(--p-surface-0);
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &.clickable {
        cursor: pointer;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
    }
}

.image-wrapper {
    position: relative;
    width: 100%;
    padding-top: 100%; // 1:1 aspect ratio
    overflow: hidden;
    background-color: var(--p-surface-100);
}

.image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.no-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-text-muted-color);

    i {
        font-size: 4rem;
    }
}

.image-overlay {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
}

.image-info {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.image-filename {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
}

.image-date {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
    margin: 0;
}

.image-metadata {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
    margin: 0;
    font-family: monospace;
}
</style>
