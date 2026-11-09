import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh' // Pastikan ini terinstal jika digunakan

export default [
  {
    ignores: ['dist/**', 'my-app/**', 'documentation.md', '.history/**', 'node_modules/**', 'build/**', 'coverage/**'],
    files: ['./src/**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      // toISOString() memakai UTC: di WIB dini hari (00.00-07.00) tanggalnya mundur sehari. Pakai todayISO()/toISODate() dari utils/dateRange.
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.property.name=/^(slice|split|substring)$/][callee.object.callee.property.name='toISOString']",
        message: 'Jangan ambil tanggal dari toISOString() (UTC, bisa mundur sehari di WIB). Gunakan todayISO()/toISODate() dari src/utils/dateRange.',
      }],
      'no-unused-vars': ['error', { 
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
  },
  {
    files: ['./src/config/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['./src/**/*.test.{js,jsx}', './src/**/__tests__/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  }
]
