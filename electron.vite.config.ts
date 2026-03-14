import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                external: ['sentencex-wasm'],
            },
        },
        resolve: {
            alias: {
                '@main': resolve('src/main'),
                '@shared': resolve('src/shared'),
            },
        },
    },
    preload: {
        build: {
            rollupOptions: {
                output: {
                    format: 'cjs',
                    entryFileNames: '[name].js',
                },
            },
        },
        resolve: {
            alias: {
                '@shared': resolve('src/shared'),
            },
        },
    },
    renderer: {
        plugins: [react()],
        resolve: {
            alias: {
                '@renderer': resolve('src/renderer'),
                '@shared': resolve('src/shared'),
            },
        },
        css: {
            preprocessorOptions: {
                scss: {},
            },
        },
    },
});
