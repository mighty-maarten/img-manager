import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import checker from 'vite-plugin-checker';

// https://vite.dev/config/
// Environment variables:
// - Vite automatically loads .env files from the project root
// - Only variables prefixed with VITE_ are exposed to the client
// - Variables are statically replaced at build time
// - See env.d.ts for type definitions
// - envDir is set to load from monorepo root for shared configuration
export default defineConfig({
    envDir: '../..',
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
