module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-fallthrough': 'off',
    'no-sparse-arrays': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-redeclare': 'off',
    'react-hooks/exhaustive-deps': 'warn'
  }
}; 