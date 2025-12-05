import { RouteTree } from '@nestjs/core';
import { LabelsModule } from './labels.module';

export const labelsRouteTree: RouteTree = {
    path: 'labels',
    module: LabelsModule,
};
