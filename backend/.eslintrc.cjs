// Minimal config so `npm run lint` — and the CI job that runs it — has
// something to check against. Recommended rules fail the build; `any` and
// unused vars, which this codebase leans on, are warnings so they surface
// without blocking.
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    env: { node: true, es2022: true },
    ignorePatterns: ['dist', 'coverage', 'node_modules'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
    },
};
