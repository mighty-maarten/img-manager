import { RouteTree } from '@nestjs/core';
import { ProcessedImagesModule } from './processed-images.module';

export const processedImagesRouteTree: RouteTree = {
    path: 'processed-images',
    module: ProcessedImagesModule,
};
