import { type Plugin } from 'vue';
import { createI18n } from 'vue-i18n';
import en from '@/assets/locales/en.json';
import nl from '@/assets/locales/nl.json';

const instance = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, nl },
});

export const i18nPlugin: Plugin = {
    install(app) {
        app.use(instance);
    },
};

export const i18n = instance.global;
