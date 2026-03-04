import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'out/**',
      'release/**',
      'node_modules/**',
      'resources/**',
      'drizzle/**',
      'modules/**',
      // Legacy source files (will be removed in Phase 8)
      'src/main.dev.ts',
      'src/index.tsx',
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
      'src/renderer/app.tsx',
      'src/renderer/hooks.ts',
      'src/renderer/plugins/**',
      'src/renderer/store/**',
      'src/renderer/components/**',
      'src/renderer/views/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
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
      ...reactHooksPlugin.configs.recommended.rules,
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
