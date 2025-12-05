<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCollectionsStore } from '@/stores/collections';
import { useToastMessages } from '@/composables/toast';
import { Button, InputText, MultiSelect } from 'primevue';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';
import type { Label } from '@/api/services/types/label.ts';
import type { Collection } from '@/api/services/types/collection';
import { useLabelsStore } from '@/stores/labels.ts';

const route = useRoute();
const router = useRouter();
const collectionsStore = useCollectionsStore();
const labelsStore = useLabelsStore();
const { successToast, errorToast } = useToastMessages();
const { t } = useI18n();

const collectionId = route.params.collectionId as string;
const collectionUrl = ref('');
const selectedLabels = ref<Label[]>([]);
const isLoading = ref(true);

onMounted(async () => {
    try {
        isLoading.value = true;
        // Load labels first
        await labelsStore.fetchLabels();

        // Try to find collection in store first
        let collection: Collection | null | undefined = collectionsStore.collections.find((c) => c.id === collectionId);

        // If not in store, fetch from API
        if (!collection) {
            collection = await collectionsStore.fetchCollection(collectionId);
        }

        if (collection) {
            collectionUrl.value = collection.url;
            // Map label IDs to full label objects
            selectedLabels.value = collection.labels || [];
        } else {
            errorToast(t('collections.edit.notFound'), '');
            router.push({ name: 'common_collections' });
        }
    } finally {
        isLoading.value = false;
    }
});

async function handleSubmit() {
    await collectionsStore.updateCollection(collectionId, {
        url: collectionUrl.value,
        labelIds: selectedLabels.value.length > 0
            ? selectedLabels.value.map((c) => c.id)
            : undefined,
    });

    if (!collectionsStore.hasError('updateCollection', collectionId)) {
        successToast(t('collections.edit.success'), '');
        router.push({ name: 'common_collections' });
    } else {
        errorToast(t('collections.edit.error'), '');
    }
}

function handleBack() {
    router.push({ name: 'common_collections' });
}
</script>

<template>
    <main>
        <div class="page-container">
            <div class="header">
                <div class="header-title">
                    <Button
                        :icon="Icons.arrowLeft"
                        severity="secondary"
                        text
                        rounded
                        @click="handleBack"
                        class="back-button"
                    />
                    <h1 class="page-title">{{ t('collections.edit.title') }}</h1>
                </div>
            </div>

            <div v-if="!isLoading" class="form-card">
                <form @submit.prevent="handleSubmit" class="collection-form">
                    <div class="form-field">
                        <label for="url">{{ t('collections.edit.url') }}</label>
                        <InputText
                            id="url"
                            v-model="collectionUrl"
                            :placeholder="t('collections.edit.urlPlaceholder')"
                            :disabled="collectionsStore.isLoading('updateCollection', collectionId)"
                            type="url"
                            required
                        />
                    </div>

                    <div class="form-field">
                        <label for="labels">{{ t('collections.edit.labels') }}</label>
                        <MultiSelect
                            id="labels"
                            v-model="selectedLabels"
                            :options="labelsStore.labels"
                            option-label="name"
                            :placeholder="t('collections.edit.labelsPlaceholder')"
                            :disabled="collectionsStore.isLoading('updateCollection', collectionId)"
                            :loading="labelsStore.isLoading('fetchLabels')"
                            display="chip"
                        />
                    </div>

                    <div class="form-actions">
                        <Button
                            type="submit"
                            :label="t('collections.edit.save')"
                            :loading="collectionsStore.isLoading('updateCollection', collectionId)"
                        />
                    </div>
                </form>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

.collection-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}
</style>
