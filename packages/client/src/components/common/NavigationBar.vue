<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Icons } from '@/types/icons';
import { Button, Menu } from 'primevue';
import { useAuthStore } from '@/stores/auth';
import { useProcessedImagesStore } from '@/stores/processed-images.ts';
import { useI18n } from 'vue-i18n';
import type { MenuItem } from 'primevue/menuitem';
import { useToastMessages } from '@/composables/toast';

const router = useRouter();
const authStore = useAuthStore();
const processedImagesStore = useProcessedImagesStore();
const { t } = useI18n();
const { successToast, errorToast } = useToastMessages();

const settingsMenu = ref<InstanceType<typeof Menu>>();

const menuItems = ref<MenuItem[]>([
    {
        label: t('sync.title'),
        icon: Icons.refresh,
        command: async () => {
            const result = await processedImagesStore.syncProcessedImages();
            if (result) {
                if (result.errors.length > 0) {
                    errorToast(t('sync.title'), t('sync.errorMessage', {
                        processed: result.processed,
                        skipped: result.skipped,
                        failed: result.failed
                    }));
                } else {
                    successToast(t('sync.title'), t('sync.successMessage', {
                        processed: result.processed,
                        skipped: result.skipped
                    }));
                }
            }
        },
    },
    {
        separator: true,
    },
    {
        label: t('auth.logout'),
        icon: Icons.logout,
        command: () => {
            authStore.logout();
            router.push({ name: 'auth_login' });
        },
    },
]);

function toggleSettingsMenu(event: Event) {
    settingsMenu.value?.toggle(event);
}
</script>

<template>
    <nav class="nav">
        <div class="heading-text">
            <div class="title">{{ $t('site.title') }}</div>
        </div>
        <div class="nav-items">
            <RouterLink :to="{ name: 'common_labels' }" class="nav-link">
                {{ t('nav.labels') }}
            </RouterLink>
            <RouterLink :to="{ name: 'common_collections' }" class="nav-link">
                {{ t('nav.collections') }}
            </RouterLink>
            <RouterLink :to="{ name: 'common_processed_images' }" class="nav-link">
                {{ t('nav.processedImages') }}
            </RouterLink>
        </div>
        <div class="end">
            <Button
                :variant="'outlined'"
                :icon="Icons.settings"
                :severity="'secondary'"
                rounded
                @click="toggleSettingsMenu"
            />
            <Menu ref="settingsMenu" :model="menuItems" :popup="true" />
        </div>
    </nav>
</template>

<style scoped lang="scss">
.nav {
    padding: $spacing-md;
    height: 50px;

    box-shadow: $shadow-md;

    display: flex;
    gap: $spacing-sm;
    align-items: center;

    .logo {
        height: 100%;
    }

    .heading-text {
        display: flex;
        flex-direction: column;
        justify-content: center;
        margin-right: 100px;

        .title {
            font-weight: $font-weight-semibold;
        }
    }

    .nav-items {
        display: flex;
        gap: $spacing-md;
        margin-left: $spacing-lg;
        align-items: center;

        .nav-link {
            text-decoration: none;
            color: var(--p-text-color);
            font-weight: 500;
            padding: $spacing-xs $spacing-sm;
            border-radius: var(--p-border-radius-sm);
            transition: background-color 0.2s;

            &:hover {
                background-color: var(--p-surface-100);
            }

            &.router-link-active {
                color: var(--p-primary-color);
                background-color: var(--p-primary-50);
            }
        }
    }

    .end {
        display: flex;
        align-items: center;
        margin-left: auto;
    }
}
</style>
