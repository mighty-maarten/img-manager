import { HttpClient } from '@/api/http-client';
import type { ProcessedImage, GetProcessedImagesQuery, SyncProcessedImagesResult, UpdateProcessedImageHiddenRequest, UpdateProcessedImageFlaggedRequest, UpdateProcessedImageScoreRequest } from './types/processed-image';
import type { PagedResult } from './types/collection';

export class ProcessedImageService {
    private static readonly BASE_PATH = '/processed-images';

    /**
     * @deprecated Use syncByLabel instead. This method will be removed in a future version.
     */
    public static async syncProcessedImages(): Promise<SyncProcessedImagesResult> {
        return HttpClient.post<Record<string, never>, SyncProcessedImagesResult>(`${this.BASE_PATH}/sync`, {});
    }

    public static async syncByLabel(labelId: string): Promise<SyncProcessedImagesResult> {
        return HttpClient.post<Record<string, never>, SyncProcessedImagesResult>(`${this.BASE_PATH}/sync/${labelId}`, {});
    }

    public static async getProcessedImages(runId?:string,query?: GetProcessedImagesQuery): Promise<PagedResult<ProcessedImage>> {
        const searchParams = new URLSearchParams();

        if (query?.take !== undefined) {
            searchParams.append('take', query.take.toString());
        }

        if (query?.skip !== undefined) {
            searchParams.append('skip', query.skip.toString());
        }

        if (query?.sort) {
            searchParams.append('sort', JSON.stringify(query.sort));
        }

        if (query?.hidden === true || query?.hidden === false) {
            searchParams.append('hidden', JSON.stringify(query.hidden));
        }

        if (query?.flagged === true || query?.flagged === false) {
            searchParams.append('flagged', JSON.stringify(query.flagged));
        }

        if (query?.minimalScore !== undefined) {
            searchParams.append('minimalScore', query.minimalScore.toString());
        }

        if (query?.labelIds) {
            searchParams.append('labelIds', query.labelIds);
        }

        return HttpClient.get<PagedResult<ProcessedImage>>(
            runId?`${this.BASE_PATH}/runs/${runId}`:this.BASE_PATH,
            searchParams.toString() ? searchParams : undefined
        );
    }

    public static async getProcessedImage(id: string): Promise<ProcessedImage> {
        return HttpClient.get<ProcessedImage>(`${this.BASE_PATH}/${id}`);
    }

    public static async updateProcessedImageHidden(id: string, hidden: boolean): Promise<ProcessedImage> {
        const request: UpdateProcessedImageHiddenRequest = { hidden };
        return HttpClient.patch<UpdateProcessedImageHiddenRequest, ProcessedImage>(
            `${this.BASE_PATH}/${id}/hidden`,
            request
        );
    }

    public static async updateProcessedImageFlagged(id: string, flagged: boolean): Promise<ProcessedImage> {
        const request: UpdateProcessedImageFlaggedRequest = { flagged };
        return HttpClient.patch<UpdateProcessedImageFlaggedRequest, ProcessedImage>(
            `${this.BASE_PATH}/${id}/flagged`,
            request
        );
    }

    public static async updateProcessedImageScore(id: string, score: number | null): Promise<ProcessedImage> {
        const request: UpdateProcessedImageScoreRequest = { score: score ?? undefined };
        return HttpClient.patch<UpdateProcessedImageScoreRequest, ProcessedImage>(
            `${this.BASE_PATH}/${id}/score`,
            request
        );
    }
}
