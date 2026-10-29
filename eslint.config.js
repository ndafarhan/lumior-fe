import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'src/lib/api/schema.d.ts', 'public/mockServiceWorker.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Money stays a decimal string end to end; floats would lose digits.
    files: ['src/lib/money/**', 'src/components/money/**'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Keep money as a decimal string; never parse it to a float.',
        },
        {
          name: 'parseInt',
          message: 'Keep money as a decimal string; never parse it to a number.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='Number']",
          message: 'Keep money as a decimal string; never convert it with Number().',
        },
        {
          selector: "MemberExpression[object.name='Number'][property.name=/^parse/]",
          message: 'Keep money as a decimal string; never parse it to a number.',
        },
        {
          selector: "UnaryExpression[operator='+']",
          message: 'Keep money as a decimal string; never convert it with unary +.',
        },
      ],
    },
  },
  {
    // Tests are never hot-reloaded.
    files: ['tests/**', '**/*.test.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // shadcn/ui files export variant helpers next to their components.
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
