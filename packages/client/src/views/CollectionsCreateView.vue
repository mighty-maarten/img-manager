<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCollectionsStore } from '@/stores/collections';
import { useLabelsStore } from '@/stores/labels';
import { useToastMessages } from '@/composables/toast';
import { Button, Textarea, MultiSelect, Message } from 'primevue';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';
import type { Label } from '@/api/services/types/label.ts';

const router = useRouter();
const collectionsStore = useCollectionsStore();
const labelsStore = useLabelsStore();
const { successToast, errorToast } = useToastMessages();
const { t } = useI18n();

const collectionUrls = ref('');
const selectedLabels = ref<Label[]>([]);
const bulkResult = ref<{ created: number; failed: Record<string, string> } | null>(null);

onMounted(async () => {
    await labelsStore.fetchLabels();
});

async function handleSubmit() {
    // Parse URLs from textarea (one per line)
    const urls = collectionUrls.value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    if (urls.length === 0) {
        errorToast(t('collections.add.error'), 'Please enter at least one URL');
        return;
    }

    const result = await collectionsStore.createCollections({
        urls: urls,
        labelIds: selectedLabels.value.length > 0
            ? selectedLabels.value.map((c) => c.id)
            : undefined,
    });

    if (!collectionsStore.hasError('createCollections') && result) {
        const createdCount = result.created.length;
        const failedCount = Object.keys(result.failed).length;

        // Store result for display
        bulkResult.value = {
            created: createdCount,
            failed: result.failed
        };

        if (failedCount === 0) {
            // All succeeded
            successToast(
                t('collections.add.success', { count: createdCount }),
                ''
            );
            router.push({ name: 'common_collections' });
        } else if (createdCount > 0) {
            // Partial success
            successToast(
                t('collections.add.partialSuccess', { created: createdCount, failed: failedCount }),
                ''
            );
        } else {
            // All failed
            errorToast(t('collections.add.error'), '');
        }
    } else {
        errorToast(t('collections.add.error'), '');
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
                    <h1 class="page-title">{{ t('collections.add.title') }}</h1>
                </div>
            </div>

            <div class="form-card">
                <form @submit.prevent="handleSubmit" class="collection-form">
                    <div class="form-field">
                        <label for="urls">{{ t('collections.add.urls') }}</label>
                        <Textarea
                            id="urls"
                            v-model="collectionUrls"
                            :placeholder="t('collections.add.urlsPlaceholder')"
                            :disabled="collectionsStore.isLoading('createCollections')"
                            required
                            rows="10"
                        />
                    </div>

                    <div class="form-field">
                        <label for="labels">{{ t('collections.add.labels') }}</label>
                        <MultiSelect
                            id="labels"
                            v-model="selectedLabels"
                            :options="labelsStore.labels"
                            option-label="name"
                            :placeholder="t('collections.add.labelsPlaceholder')"
                            :disabled="collectionsStore.isLoading('createCollections')"
                            :loading="labelsStore.isLoading('fetchLabels')"
                            display="chip"
                        />
                    </div>

                    <div v-if="bulkResult && Object.keys(bulkResult.failed).length > 0" class="form-field">
                        <Message severity="warn" :closable="false">
                            <strong>{{ t('collections.add.results.failed') }}:</strong>
                            <ul class="error-list">
                                <li v-for="(error, url) in bulkResult.failed" :key="url">
                                    <strong>{{ url }}:</strong> {{ error }}
                                </li>
                            </ul>
                        </Message>
                    </div>

                    <div class="form-actions">
                        <Button
                            type="submit"
                            :label="t('collections.add.save')"
                            :loading="collectionsStore.isLoading('createCollections')"
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

.error-list {
    margin: 0.5rem 0 0 1rem;
    padding: 0;
    list-style-type: disc;

    li {
        margin: 0.25rem 0;
    }
}
</style>
