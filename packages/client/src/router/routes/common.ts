import HomeView from '@/views/HomeView.vue';
import CollectionsView from '@/views/CollectionsView.vue';
import CollectionsCreateView from '@/views/CollectionsCreateView.vue';
import CollectionEditView from '@/views/CollectionEditView.vue';
import CollectionDetailView from '@/views/CollectionDetailView.vue';
import type { RouteRecordRaw } from 'vue-router';
import LabelEditView from '@/views/LabelEditView.vue';
import LabelCreateView from '@/views/LabelCreateView.vue';
import LabelsView from '@/views/LabelsView.vue';
import ProcessedImagesView from '@/views/ProcessedImagesView.vue';
import ProcessedImageDetailView from '@/views/ProcessedImageDetailView.vue';
import ScrapeImageDetailView from '@/views/ScrapeImageDetailView.vue';
import MinimalLayout from '@/layouts/MinimalLayout.vue';

const routesCommon = {
    HOME: 'common_home',
    LABELS: 'common_labels',
    LABEL_CREATE: 'common_label_create',
    LABEL_EDIT: 'common_label_edit',
    COLLECTIONS: 'common_collections',
    COLLECTIONS_CREATE: 'common_collections_create',
    COLLECTION_EDIT: 'common_collection_edit',
    COLLECTION_DETAIL: 'common_collection_detail',
    PROCESSED_IMAGES: 'common_processed_images',
    PROCESSED_IMAGE_DETAIL: 'common_processed_image_detail',
    SCRAPE_IMAGE_DETAIL: 'common_scrape_image_detail',
} as const;

export type CommonRoutes = (typeof routesCommon)[keyof typeof routesCommon];

export type CommonRouteParams = {
    [routesCommon.HOME]: undefined;
    [routesCommon.LABELS]: undefined;
    [routesCommon.LABEL_CREATE]: undefined;
    [routesCommon.LABEL_EDIT]: { labelId: string };
    [routesCommon.COLLECTIONS]: undefined;
    [routesCommon.COLLECTIONS_CREATE]: undefined;
    [routesCommon.COLLECTION_EDIT]: { collectionId: string };
    [routesCommon.COLLECTION_DETAIL]: { collectionId: string };
    [routesCommon.PROCESSED_IMAGES]: undefined;
    [routesCommon.PROCESSED_IMAGE_DETAIL]: { id: string };
    [routesCommon.SCRAPE_IMAGE_DETAIL]: { collectionId: string; scrapeId: string; imageIndex: string };
};

export const commonRoutes = [
    {
        path: '/',
        name: routesCommon.HOME,
        component: HomeView,
    },
    {
        path: '/labels',
        name: routesCommon.LABELS,
        component: LabelsView,
    },
    {
        path: '/labels/create',
        name: routesCommon.LABEL_CREATE,
        component: LabelCreateView,
    },
    {
        path: '/labels/:labelId',
        name: routesCommon.LABEL_EDIT,
        component: LabelEditView,
    },
    {
        path: '/collections',
        name: routesCommon.COLLECTIONS,
        component: CollectionsView,
    },
    {
        path: '/collections/create-bulk',
        name: routesCommon.COLLECTIONS_CREATE,
        component: CollectionsCreateView,
    },
    {
        path: '/collections/:collectionId',
        name: routesCommon.COLLECTION_DETAIL,
        component: CollectionDetailView,
    },
    {
        path: '/collections/:collectionId',
        name: routesCommon.COLLECTION_EDIT,
        component: CollectionEditView,
    },
    {
        path: '/processed-images',
        name: routesCommon.PROCESSED_IMAGES,
        component: ProcessedImagesView,
    },
    {
        path: '/processed-images/:id',
        name: routesCommon.PROCESSED_IMAGE_DETAIL,
        component: ProcessedImageDetailView,
        meta: {
            layout: MinimalLayout,
        },
    },
    {
        path: '/collections/:collectionId/scrape/:scrapeId/image/:imageIndex',
        name: routesCommon.SCRAPE_IMAGE_DETAIL,
        component: ScrapeImageDetailView,
        meta: {
            layout: MinimalLayout,
        },
    },
] satisfies RouteRecordRaw[];
