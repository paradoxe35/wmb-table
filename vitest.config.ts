import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
    esbuild: { jsx: 'automatic' },
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.{ts,tsx}'],
        exclude: ['node_modules', 'out', 'release'],
        passWithNoTests: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.d.ts'],
        },
    },
    resolve: {
        alias: {
            '@main': resolve(__dirname, 'src/main'),
            '@renderer': resolve(__dirname, 'src/renderer'),
            '@shared': resolve(__dirname, 'src/shared'),
        },
    },
});
