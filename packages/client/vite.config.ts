import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import checker from 'vite-plugin-checker';

// https://vite.dev/config/
// Environment variables:
// - Vite automatically loads .env files from this package directory
// - Only variables prefixed with VITE_ are exposed to the client
// - Variables are statically replaced at build time
// - See env.d.ts for type definitions
export default defineConfig({
    plugins: [
        vue(),
        vueDevTools(),
        checker({
            typescript: true,
            vueTsc: {
                tsconfigPath: './tsconfig.app.json',
            },
            terminal: true,
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `
                    @use "@/styles/mixins.scss" as *;
                    @use "@/styles/variables.scss" as *;
                `,
            },
        },
    },
});
