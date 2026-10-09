module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'react-refresh/only-export-components': 'off',
  },
};
