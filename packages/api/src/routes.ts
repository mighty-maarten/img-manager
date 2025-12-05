import { Routes, RouteTree } from '@nestjs/core';
import { usersRouteTree } from './users/route-tree';
import { authRouteTree } from './auth/route-tree';
import { labelsRouteTree } from './labels/route-tree';
import { collectionsRouteTree } from './collections/route-tree';
import { processedImagesRouteTree } from './processed-images/route-tree';
import { Type } from '@nestjs/common';

export const routes: Routes = [
    {
        path: '',
        children: [
            authRouteTree,
            usersRouteTree,
            labelsRouteTree,
            collectionsRouteTree,
            processedImagesRouteTree,
        ],
    },
];

export function getModulesFromRoutes(routes: RouteTree[]): Type<any>[] {
    const modules: Type<any>[] = [];

    for (const route of routes) {
        if (route.module) modules.push(route.module);
        if (route.children) modules.push(...getModulesFromRoutes(route.children as RouteTree[]));
    }

    return modules;
}
