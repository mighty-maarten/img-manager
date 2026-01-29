
import { HttpClient } from '@/api/http-client';
import type { Collection, UpdateCollectionRequest, ScrapeCollectionRequest, ScrapeResult, CreateCollectionsContract, CreateCollectionsResultContract, GetCollectionsQuery, PagedResult, CollectionDownloadUrls } from './types/collection';

export class CollectionService {
    private static readonly BASE_PATH = '/collections';

    public static async getCollections(query?: GetCollectionsQuery): Promise<PagedResult<Collection>> {
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

        if (query?.scraped=== true || query?.scraped === false) {
            searchParams.append('scraped', JSON.stringify(query.scraped));
        }

        if (query?.stored=== true || query?.stored === false) {
            searchParams.append('stored', JSON.stringify(query.stored));
        }

        if (query?.processed) {
            searchParams.append('processed', query.processed);
        }

        if (query?.labelIds) {
            searchParams.append('labelIds', query.labelIds);
        }

        return HttpClient.get<PagedResult<Collection>>(
            this.BASE_PATH,
            searchParams.toString() ? searchParams : undefined
        );
    }

    public static async getCollection(id: string): Promise<Collection> {
        return HttpClient.get<Collection>(`${this.BASE_PATH}/${id}`);
    }

    public static async createCollections(data: CreateCollectionsContract): Promise<CreateCollectionsResultContract> {
        return HttpClient.post<CreateCollectionsContract, CreateCollectionsResultContract>(this.BASE_PATH, data);
    }

    public static async updateCollection(
        id: string,
        data: UpdateCollectionRequest,
    ): Promise<Collection> {
        return HttpClient.put<UpdateCollectionRequest, Collection>(`${this.BASE_PATH}/${id}`, data);
    }

    public static async deleteCollection(id: string): Promise<void> {
        return HttpClient.delete<void>(`${this.BASE_PATH}/${id}`);
    }

    public static async scrapeCollection(id: string, data: ScrapeCollectionRequest): Promise<ScrapeResult> {
        return HttpClient.post<ScrapeCollectionRequest, ScrapeResult>(`${this.BASE_PATH}/${id}/scrape`, data);
    }

    public static async getScrapeResult(collectionId: string, scrapeId: string): Promise<ScrapeResult> {
        return HttpClient.get<ScrapeResult>(`${this.BASE_PATH}/${collectionId}/scrape/${scrapeId}`);
    }

    public static async storeScrape(collectionId: string, scrapeId: string): Promise<void> {
        return HttpClient.post<Record<string, never>, void>(`${this.BASE_PATH}/${collectionId}/scrape/${scrapeId}/store`, {});
    }

    public static async getCollectionDownloadUrls(collectionId: string): Promise<CollectionDownloadUrls> {
        return HttpClient.get<CollectionDownloadUrls>(`${this.BASE_PATH}/${collectionId}/download`);
    }
}
