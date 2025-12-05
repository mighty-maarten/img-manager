import LoginView from '@/views/LoginView.vue';
import FullPageLayout from '@/layouts/FullPageLayout.vue';
import type { RouteRecordRaw } from 'vue-router';

const routesAuth = {
    LOGIN: 'auth_login',
} as const;

export type AuthRoutes = (typeof routesAuth)[keyof typeof routesAuth];

export type AuthRouteParams = {
    [R in AuthRoutes]: undefined;
};

export const authRoutes = [
    {
        path: '/login',
        name: routesAuth.LOGIN,
        component: LoginView,
        meta: {
            layout: FullPageLayout,
        },
    },
] satisfies RouteRecordRaw[];
