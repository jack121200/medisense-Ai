// Minimal config so `npm run lint` — and the CI job that runs it — has
// something to check against. Recommended rules and the rules of hooks fail
// the build; `any`, unused vars and effect dependencies are warnings.
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'react-hooks'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
    env: { browser: true, es2022: true },
    ignorePatterns: ['dist', 'node_modules'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
        // `try { … } catch {}` is used deliberately around best-effort calls
        // (localStorage, optional fetches) where failure just means "skip".
        'no-empty': ['error', { allowEmptyCatch: true }],
    },
};
