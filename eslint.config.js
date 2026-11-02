import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/playwright-report/**', '**/test-results/**'],
  },
  {
    // Correctness rules only: the ones where a failure is a real defect rather
    // than a preference. Prettier owns formatting.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-compare': 'error',
      'no-sparse-arrays': 'error',
      'no-constant-binary-expression': 'error',
      // `found != null` is the idiom for "neither null nor undefined".
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      // Core `no-unused-vars` reads parameter names in a type signature as
      // unused variables; the plugin's rule understands declaration space.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '19.2' } },
    rules: {
      // A component defined inside another component is a new type on every
      // render, so React remounts its subtree instead of updating it.
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]
