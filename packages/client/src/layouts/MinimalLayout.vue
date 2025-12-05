<script setup lang="ts">
import { ConfirmDialog, Toast } from 'primevue';
</script>

<template>
    <Toast />
    <ConfirmDialog class="whitespace-pre" />
    <div class="minimal-layout-wrapper">
        <slot>
            <RouterView />
        </slot>
    </div>
</template>

<style scoped lang="scss">
.minimal-layout-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.95);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>
