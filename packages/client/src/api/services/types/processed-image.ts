import type { SortMeta } from './collection';

export type CollectionReference = {
    id: string;
    url: string;
};

export type ProcessedImage = {
    id: string;
    filename: string;
    bucket: string;
    key: string;
    url: string;
    hidden: boolean;
    flagged: boolean;
    score?: number;
    createdOn: Date;
    lastUpdatedOn: Date;
    collections?: CollectionReference[];
};

export type GetProcessedImagesQuery = {
    take?: number;
    skip?: number;
    sort?: SortMeta;
    hidden?: boolean;
    flagged?: boolean;
    minimalScore?: number;
    labelIds?: string;
};

export type SyncProcessedImagesResult = {
    processed: number;
    skipped: number;
    failed: number;
    errors: string[];
};

export type UpdateProcessedImageHiddenRequest = {
    hidden: boolean;
};

export type UpdateProcessedImageFlaggedRequest = {
    flagged: boolean;
};

export type UpdateProcessedImageScoreRequest = {
    score?: number;
};
