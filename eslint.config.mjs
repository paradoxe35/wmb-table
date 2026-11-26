import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: [
            'out/**',
            'tmp/**',
            'release/**',
            'node_modules/**',
            'resources/**',
            'drizzle/**',
            // Legacy source files (still being migrated)
            'src/index.html',
            'src/app.global.scss',
            'src/sys.ts',
            'src/ipc/**',
            'src/utils/**',
            'src/types/**',
            'src/main/childs_processes/**',
            'src/main/db/**',
            'src/main/dialogs/**',
            'src/main/features/**',
            'src/main/functions/**',
            'src/main/message-control/**',
            'src/main/platforms/**',
            'src/renderer/hooks.ts',
        ],
    },
    {
        files: ['**/*.{ts,tsx,mts}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            // Only the classic hook rules. The React Compiler rules added in
            // eslint-plugin-react-hooks 7 (refs, set-state-in-effect, immutability, ...)
            // flag existing code and are adopted in a separate cleanup.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
        },
        settings: {
            react: { version: 'detect' },
        },
    },
];
