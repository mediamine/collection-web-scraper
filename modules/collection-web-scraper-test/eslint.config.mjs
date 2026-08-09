import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// ESLint 9 flat config — replaces the legacy .eslintrc.js.
// typescript-eslint "recommended" is the non-type-checked ruleset, so no tsconfig is required.
// eslint-config-prettier (last) disables formatting rules; Prettier runs separately
// via `yarn format` / `yarn format:check` — ESLint does code quality only.
export default tseslint.config(
  { ignores: ['node_modules', 'playwright-report', 'test-results'] },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  }
);
