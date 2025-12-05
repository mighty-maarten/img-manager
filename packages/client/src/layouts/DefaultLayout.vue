<script setup lang="ts">
import { ConfirmDialog, Toast } from 'primevue';
import NavigationBar from '@/components/common/NavigationBar.vue';
</script>

<template>
    <Toast />
    <ConfirmDialog class="whitespace-pre" />
    <div class="page-wrapper">
        <NavigationBar />
        <div class="page-view">
            <slot>
                <RouterView />
            </slot>
        </div>
    </div>
</template>

<style scoped lang="scss">
.page-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;

    .page-view {
        flex: 1;
        display: flex;
        overflow: hidden;
        width: 100%;
        height: 100%;
        min-height: 0;
    }
}
</style>
