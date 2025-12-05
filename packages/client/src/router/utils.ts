import type { RouteLocationNamedRaw } from 'vue-router';
import type { CommonRouteParams, CommonRoutes } from './routes/common';

export const defaultRedirectRoute = buildRoute('common_home');

export type Routes = CommonRoutes; // |
export type RouteParams = CommonRouteParams; // &

type IsEmptyObject<T> = keyof T extends never ? true : false;

export function buildRoute<R extends Routes>(
    route: R,
    ...params: IsEmptyObject<RouteParams[R]> extends true ? [undefined?] : [RouteParams[R]]
): RouteLocationNamedRaw {
    return { name: route, params: params[0] };
}
