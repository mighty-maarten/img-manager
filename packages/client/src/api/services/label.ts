import { HttpClient } from '@/api/http-client';
import type { Label, CreateLabelRequest, UpdateLabelRequest } from './types/label.ts';

export class LabelsService {
    private static readonly BASE_PATH = '/labels';

    public static async getLabels(): Promise<Label[]> {
        return HttpClient.get<Label[]>(this.BASE_PATH);
    }

    public static async getLabel(id: string): Promise<Label> {
        return HttpClient.get<Label>(`${this.BASE_PATH}/${id}`);
    }

    public static async createLabel(data: CreateLabelRequest): Promise<Label> {
        return HttpClient.post<CreateLabelRequest, Label>(this.BASE_PATH, data);
    }

    public static async updateLabel(
        id: string,
        data: UpdateLabelRequest,
    ): Promise<Label> {
        return HttpClient.put<UpdateLabelRequest, Label>(`${this.BASE_PATH}/${id}`, data);
    }

    public static async deleteLabel(id: string): Promise<void> {
        return HttpClient.delete<void>(`${this.BASE_PATH}/${id}`);
    }
}
