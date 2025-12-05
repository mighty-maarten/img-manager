import { RouteTree } from '@nestjs/core';
import { CollectionsModule } from './collections.module';

export const collectionsRouteTree: RouteTree = {
    path: 'collections',
    module: CollectionsModule,
};
