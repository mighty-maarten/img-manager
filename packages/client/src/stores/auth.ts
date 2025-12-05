import { defineStore } from 'pinia';
import { useStoreCreationUtils } from './util';
import { AuthService } from '@/api/services/auth';
import type { LoginRequest, User } from '@/api/services/types/auth';
import { computed, ref } from 'vue';

const TOKEN_STORAGE_KEY = 'auth_token';

export const useAuthStore = defineStore('auth', () => {
    const { base, handleAction } = useStoreCreationUtils({
        actions: ['login', 'logout', 'fetchCurrentUser'],
    });

    const currentUser = ref<User | null>(null);
    const accessToken = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY));

    const isAuthenticated = computed(() => !!accessToken.value && !!currentUser.value);

    async function login(credentials: LoginRequest): Promise<void> {
        await handleAction('login', undefined, async () => {
            const response = await AuthService.login(credentials);
            accessToken.value = response.accessToken;
            currentUser.value = {
                id: response.userId,
                email: response.email,
            };
            localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
        });
    }

    function logout(): void {
        accessToken.value = null;
        currentUser.value = null;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    async function fetchCurrentUser(): Promise<void> {
        // Only fetch if we have a token
        if (!accessToken.value) {
            return;
        }

        await handleAction('fetchCurrentUser', undefined, async () => {
            const response = await AuthService.getCurrentUser();
            currentUser.value = {
                id: response.userId,
                email: response.email,
            };
        });
    }

    return {
        ...base,
        currentUser,
        accessToken,
        isAuthenticated,
        login,
        logout,
        fetchCurrentUser,
    };
});
