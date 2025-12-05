<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToastMessages } from '@/composables/toast';
import { Button, InputText } from 'primevue';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';
import { useLabelsStore } from '@/stores/labels.ts';

const route = useRoute();
const router = useRouter();
const labelsStore = useLabelsStore();
const { successToast, errorToast } = useToastMessages();
const { t } = useI18n();

const labelId = route.params.labelId as string;
const labelName = ref('');
const isLoading = ref(true);

onMounted(async () => {
    try {
        isLoading.value = true;
        const label = labelsStore.labels.find((c) => c.id === labelId);
        if (label) {
            labelName.value = label.name;
        } else {
            errorToast(t('labels.edit.notFound'), '');
            router.push({ name: 'common_labels' });
        }
    } finally {
        isLoading.value = false;
    }
});

async function handleSubmit() {
    await labelsStore.updateLabel(labelId, {
        name: labelName.value,
    });

    if (!labelsStore.hasError('updateLabel', labelId)) {
        successToast(t('labels.edit.success'), '');
        router.push({ name: 'common_labels' });
    } else {
        errorToast(t('labels.edit.error'), '');
    }
}

function handleBack() {
    router.push({ name: 'common_labels' });
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
                    <h1 class="page-title">{{ t('labels.edit.title') }}</h1>
                </div>
            </div>

            <div v-if="!isLoading" class="form-card">
                <form @submit.prevent="handleSubmit" class="label-form">
                    <div class="form-field">
                        <label for="name">{{ t('labels.edit.name') }}</label>
                        <InputText
                            id="name"
                            v-model="labelName"
                            :disabled="labelsStore.isLoading('updateLabel', labelId)"
                            required
                        />
                    </div>

                    <div class="form-actions">
                        <Button
                            type="submit"
                            :label="t('labels.edit.save')"
                            :loading="labelsStore.isLoading('updateLabel', labelId)"
                        />
                    </div>
                </form>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

.label-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}
</style>
