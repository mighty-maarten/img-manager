<script setup lang="ts">
import { Button } from 'primevue';
import { Icons } from '@/types/icons';
import { useI18n } from 'vue-i18n';

interface ImageDetailHeaderProps {
    title: string;
    showClose?: boolean;
}

const props = withDefaults(defineProps<ImageDetailHeaderProps>(), {
    showClose: true
});

const emit = defineEmits<{
    close: [];
}>();

const { t } = useI18n();
</script>

<template>
    <div class="compact-header">
        <Button
            v-if="showClose"
            :icon="Icons.close"
            severity="secondary"
            text
            rounded
            @click="emit('close')"
            class="close-button"
            v-tooltip.bottom="t('processedImages.detail.back')"
        />

        <h1 class="header-title">{{ title }}</h1>

        <div class="header-actions">
            <slot name="actions" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.compact-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 50px;
    padding: 0 0.5rem;
    background-color: rgba(0, 0, 0, 0.7);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
}

.close-button {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
}

.header-title {
    flex: 1;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0; // Allow flex item to shrink below content size
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
}

// Responsive adjustments for smaller screens/tablets
@media (max-width: 768px) {
    .header-title {
        font-size: 0.75rem;
    }

    .compact-header {
        gap: 0.5rem;
        padding: 0 0.25rem;
    }
}
</style>
