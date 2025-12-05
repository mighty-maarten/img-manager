<script setup lang="ts">
import { onMounted } from 'vue';
import { DataTable, Column, Button } from 'primevue';
import { useI18n } from 'vue-i18n';
import { DateUtil } from '@/utils/date';
import { Icons } from '@/types/icons';
import { useRouter } from 'vue-router';
import { useConfirmDialog } from '@/composables/confirm-dialog';
import { useToastMessages } from '@/composables/toast';
import type { Label } from '@/api/services/types/label.ts';
import { useLabelsStore } from '@/stores/labels.ts';

const labelsStore = useLabelsStore();
const { t } = useI18n();
const router = useRouter();
const { confirmDelete } = useConfirmDialog();
const { successToast } = useToastMessages();

onMounted(async () => {
    await labelsStore.fetchLabels();
});

function handleEdit(label: Label) {
    router.push({ name: 'common_label_edit', params: { labelId: label.id } });
}

async function handleDelete(label: Label) {
    await confirmDelete(
        t('labels.delete.title'),
        t('labels.delete.description', { name: label.name }),
        async () => {
            await labelsStore.deleteLabel(label.id);
            successToast(t('labels.delete.success'), '');
        },
    );
}
</script>

<template>
    <main>
        <div class="page-container">
            <div class="header">
                <h1 class="page-title">{{ t('labels.title') }}</h1>
                <Button
                    :label="t('labels.create')"
                    @click="router.push({ name: 'common_label_create' })"
                />
            </div>

            <DataTable
                :value="labelsStore.labels"
                :loading="labelsStore.isLoading('fetchLabels')"
                striped-rows
                paginator
                :rows="10"
                :rows-per-page-options="[5, 10, 20, 50]"
            >
                <Column field="name" :header="t('labels.table.name')" sortable></Column>
                <Column field="createdOn" :header="t('labels.table.createdOn')" sortable>
                    <template #body="{ data }">
                        {{ DateUtil.formatDateTime(data.createdOn) }}
                    </template>
                </Column>
                <Column :header="t('labels.table.actions')">
                    <template #body="{ data }">
                        <div class="action-buttons">
                            <Button
                                :icon="Icons.edit"
                                severity="secondary"
                                text
                                rounded
                                @click="handleEdit(data)"
                            />
                            <Button
                                :icon="Icons.delete"
                                severity="danger"
                                text
                                rounded
                                @click="handleDelete(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';
</style>

