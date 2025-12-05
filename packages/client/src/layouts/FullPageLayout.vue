<script setup lang="ts">
import { ConfirmDialog, Toast } from 'primevue';
</script>

<template>
    <Toast />
    <ConfirmDialog class="whitespace-pre" />
    <div class="full-page-wrapper">
        <slot>
            <RouterView />
        </slot>
    </div>
</template>

<style scoped lang="scss">
.full-page-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
}
</style>