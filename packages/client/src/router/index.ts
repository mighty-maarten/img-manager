import { createRouter, createWebHistory } from 'vue-router';
import { commonRoutes } from './routes/common';
import { authRoutes } from './routes/auth';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [...commonRoutes, ...authRoutes],
});

router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();
    const isLoginRoute = to.name === 'auth_login';

    // If we have a token but no user, fetch the current user
    if (authStore.accessToken && !authStore.currentUser) {
        await authStore.fetchCurrentUser();
    }

    // If user is authenticated and trying to access login, redirect to home
    if (isLoginRoute && authStore.isAuthenticated) {
        next({ name: 'common_home' });
        return;
    }

    // If user is not authenticated and trying to access a protected route, redirect to login
    if (!isLoginRoute && !authStore.isAuthenticated) {
        next({ name: 'auth_login' });
        return;
    }

    // Otherwise, proceed as normal
    next();
});

export default router;
