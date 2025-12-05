import { defineStore } from 'pinia';
import { useStoreCreationUtils } from './util';
import { LabelsService } from '@/api/services/label.ts';
import type { Label, CreateLabelRequest, UpdateLabelRequest } from '@/api/services/types/label.ts';
import { ref } from 'vue';

export const useLabelsStore = defineStore('labels', () => {
    const { base, handleAction } = useStoreCreationUtils({
        actions: ['fetchLabels', 'createLabel', 'updateLabel', 'deleteLabel'],
    });

    const labels = ref<Label[]>([]);

    async function fetchLabels(): Promise<void> {
        await handleAction('fetchLabels', undefined, async () => {
            labels.value = await LabelsService.getLabels();
        });
    }

    async function createLabel(data: CreateLabelRequest): Promise<void> {
        await handleAction('createLabel', undefined, async () => {
            const newLabel = await LabelsService.createLabel(data);
            labels.value.push(newLabel);
        });
    }

    async function updateLabel(id: string, data: UpdateLabelRequest): Promise<void> {
        await handleAction('updateLabel', id, async () => {
            const updatedLabel = await LabelsService.updateLabel(id, data);
            const index = labels.value.findIndex((c) => c.id === id);
            if (index !== -1) {
                labels.value[index] = updatedLabel;
            }
        });
    }

    async function deleteLabel(id: string): Promise<void> {
        await handleAction('deleteLabel', id, async () => {
            await LabelsService.deleteLabel(id);
            labels.value = labels.value.filter((c) => c.id !== id);
        });
    }

    return {
        ...base,
        labels: labels,
        fetchLabels,
        createLabel,
        updateLabel,
        deleteLabel,
    };
});
