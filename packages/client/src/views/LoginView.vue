<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToastMessages } from '@/composables/toast';
import { Button, InputText, Password } from 'primevue';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const authStore = useAuthStore();
const { errorToast } = useToastMessages();
const { t } = useI18n();

const email = ref('maarten.thoelen@mighty.be');
const password = ref('');

async function handleLogin() {
    await authStore.login({
        email: email.value,
        password: password.value,
    });

    if (authStore.isAuthenticated) {
        router.push({ name: 'common_home' });
    } else if (authStore.hasError('login')) {
        errorToast(t('auth.login.error'), '');
    }
}
</script>

<template>
    <main class="login-container">
        <div class="login-card">
            <h1 class="login-title">{{ t('site.title') }}</h1>
            <h2 class="login-subtitle">{{ t('auth.login.title') }}</h2>

            <form @submit.prevent="handleLogin" class="login-form">
                <div class="form-field">
                    <label for="email">{{ t('auth.login.email') }}</label>
                    <InputText
                        id="email"
                        v-model="email"
                        type="email"
                        :disabled="authStore.isLoading('login')"
                        required
                        autocomplete="email"
                    />
                </div>

                <div class="form-field">
                    <label for="password">{{ t('auth.login.password') }}</label>
                    <Password
                        id="password"
                        v-model="password"
                        :feedback="false"
                        :disabled="authStore.isLoading('login')"
                        toggle-mask
                        required
                        autocomplete="current-password"
                    />
                </div>

                <Button
                    type="submit"
                    :label="t('auth.login.submit')"
                    :loading="authStore.isLoading('login')"
                    class="login-button"
                />
            </form>
        </div>
    </main>
</template>

<style scoped lang="scss">
@use '@/styles/views-common.scss';

.login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 100vh;
    background: linear-gradient(135deg, var(--p-primary-500) 0%, var(--p-primary-700) 100%);
}

.login-card {
    background: var(--p-surface-0);
    border-radius: var(--p-border-radius-lg);
    box-shadow: var(--p-shadow-lg);
    padding: 3rem;
    width: 100%;
    max-width: 400px;
}

.login-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0 0 0.5rem 0;
    text-align: center;
}

.login-subtitle {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    margin: 0 0 2rem 0;
    text-align: center;
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.login-button {
    margin-top: 1rem;
    width: 100%;
}
</style>
