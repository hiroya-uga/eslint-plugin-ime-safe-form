# eslint-plugin-ime-safe-form

[![npm version](https://img.shields.io/npm/v/eslint-plugin-ime-safe-form)](https://www.npmjs.com/package/eslint-plugin-ime-safe-form)
[![license](https://img.shields.io/npm/l/eslint-plugin-ime-safe-form)](./LICENSE)

ESLint plugin to enforce IME-safe form submission for users who type with an IME (Input Method Editor).

## Quick Start

```sh
npm install --save-dev eslint-plugin-ime-safe-form
```

```js
// eslint.config.js (ESLint 9)
import imeSafeForm from 'eslint-plugin-ime-safe-form';

export default [imeSafeForm.configs.recommended];
```

For ESLint 8 / `.eslintrc` setup and advanced configuration, see [Usage](#usage).

Try it in the [playground](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form-playground).

## Why

When checking for the Enter key in `keydown`/`keyup` handlers to submit a form, users typing with an IME experience broken input: pressing Enter to **confirm IME candidates** accidentally triggers form submission before the composition is complete.

There are two correct approaches:

```js
// ✅ Option 1: guard with e.isComposing + e.keyCode === 229 (covers Safari)
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});

// ✅ Option 2: use the form's submit event (fires after composition ends)
form.addEventListener('submit', (e) => {
  e.preventDefault();
  submit();
});

// ❌ Bad — breaks IME input
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});
```

`keypress` is **prohibited entirely** as it is deprecated.

> **Safari note:** In Safari, `compositionend` fires before `keydown`, so `e.isComposing` is `false` when Enter confirms IME. The `e.keyCode === 229` check covers this gap. To require only `e.isComposing` (if Safari support is not needed), set `{ checkKeyCodeForSafari: false }` in the rule options.

> **Custom guard functions:** If you extract the `isComposing` check into a shared helper, use the `guardFunctions` option to register the function name so the rule recognises it as an IME guard:
>
> ```js
> const guardIsComposing = (e) => e.isComposing || e.keyCode === 229;
>
> // eslint.config.js
> rules: { 'ime-safe-form/require-ime-safe-submit': ['warn', { guardFunctions: ['guardIsComposing'] }] }
> ```

## Installation

```sh
npm install --save-dev eslint-plugin-ime-safe-form
```

## Usage

### Flat config (`eslint.config.js`, ESLint 9)

```js
import imeSafeForm from 'eslint-plugin-ime-safe-form';

export default [
  imeSafeForm.configs.recommended,
];
```

> **Note:** The `recommended` config sets the rule severity to `"warn"`. To treat violations as errors, configure the rule manually:
>
> ```js
> rules: { 'ime-safe-form/require-ime-safe-submit': 'error' }
> ```

### Manual configuration

```js
import imeSafeForm from 'eslint-plugin-ime-safe-form';

export default [
  {
    plugins: { 'ime-safe-form': imeSafeForm },
    rules: {
      'ime-safe-form/require-ime-safe-submit': 'warn',
    },
  },
];
```

### Legacy config (`.eslintrc.js`, ESLint 8)

```js
module.exports = {
  plugins: ['ime-safe-form'],
  extends: ['plugin:ime-safe-form/recommended:legacy'],
};
```

Or manually:

```js
module.exports = {
  plugins: ['ime-safe-form'],
  rules: {
    'ime-safe-form/require-ime-safe-submit': 'warn',
  },
};
```

### TypeScript / TSX

Install `@typescript-eslint/parser` and set it as the parser for TypeScript files:

```js
// eslint.config.js (ESLint 9)
import imeSafeForm from 'eslint-plugin-ime-safe-form';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
  },
  imeSafeForm.configs.recommended,
];
```

```js
// .eslintrc.js (ESLint 8)
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['ime-safe-form'],
  extends: ['plugin:ime-safe-form/recommended:legacy'],
};
```

## Rules

| Rule | Description | Recommended |
|---|---|---|
| [`require-ime-safe-submit`](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-submit.md) | Require IME-safe form submission (isComposing guard or form submit event) | ✅ |

### Detected patterns

- `element.addEventListener('keydown' \| 'keyup', handler)` where handler checks `e.key === 'Enter'`, `e.code === 'Enter'`, `e.keyCode === 13`, or `e.which === 13` **without** an `e.isComposing` guard
- `element.addEventListener('keypress', handler)` where handler checks for Enter — always flagged (`keypress` is deprecated)
- `element.onkeydown` / `element.onkeyup` / `element.onkeypress` assignments
- JSX `onKeyDown` / `onKeyUp` / `onKeyPress` props
- `switch(e.key) { case 'Enter': ... }` and equivalents using `e.code`, `e.keyCode`, or `e.which`

## Development

```sh
# Install dependencies
npm install

# Type-check
npm run typecheck

# Run tests (no build step needed)
npm test

# Build for publishing
npm run build
```

### Project structure

```
src/
  index.ts              # Plugin entry point
  rules/
    require-ime-safe-submit.ts
tests/
  require-ime-safe-submit.test.ts
docs/
  rules/
    require-ime-safe-submit.md
dist/                   # Built output (generated by npm run build)
```

## License

MIT © Hiroya Uga
