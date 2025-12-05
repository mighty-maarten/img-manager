<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLabelsStore } from '@/stores/labels';
import { useToastMessages } from '@/composables/toast';
import { Button, InputText } from 'primevue';
import { useI18n } from 'vue-i18n';
import { Icons } from '@/types/icons';

const router = useRouter();
const labelsStore = useLabelsStore();
const { successToast, errorToast } = useToastMessages();
const { t } = useI18n();

const labelName = ref('');

async function handleSubmit() {
    await labelsStore.createLabel({
        name: labelName.value,
    });

    if (!labelsStore.hasError('createLabel')) {
        successToast(t('labels.add.success'), '');
        router.push({ name: 'common_labels' });
    } else {
        errorToast(t('labels.add.error'), '');
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
                    <h1 class="page-title">{{ t('labels.add.title') }}</h1>
                </div>
            </div>

            <div class="form-card">
                <form @submit.prevent="handleSubmit" class="label-form">
                    <div class="form-field">
                        <label for="name">{{ t('labels.add.name') }}</label>
                        <InputText
                            id="name"
                            v-model="labelName"
                            :disabled="labelsStore.isLoading('createLabel')"
                            required
                        />
                    </div>

                    <div class="form-actions">
                        <Button
                            type="submit"
                            :label="t('labels.add.save')"
                            :loading="labelsStore.isLoading('createLabel')"
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
