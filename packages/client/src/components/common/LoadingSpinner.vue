<script setup lang="ts">
import { ProgressSpinner } from 'primevue';

defineProps<{
    size?: string;
}>();
</script>

<template>
    <div class="spinner">
        <ProgressSpinner
            style="width: 50px; height: 50px"
            strokeWidth="6"
            fill="transparent"
            animationDuration="1s"
            aria-label="Loading spinner"
        />
    </div>
</template>

<style scoped lang="scss">
.spinner {
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>
