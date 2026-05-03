# eslint-plugin-ime-safe-form

[![npm version](https://img.shields.io/npm/v/eslint-plugin-ime-safe-form)](https://www.npmjs.com/package/eslint-plugin-ime-safe-form)
[![npm downloads](https://img.shields.io/npm/dw/eslint-plugin-ime-safe-form)](https://www.npmjs.com/package/eslint-plugin-ime-safe-form)
[![CI](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/actions/workflows/ci.yml/badge.svg)](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/actions/workflows/ci.yml)
[![Socket Badge](https://badge.socket.dev/npm/package/eslint-plugin-ime-safe-form)](https://socket.dev/npm/package/eslint-plugin-ime-safe-form)
[![license](https://img.shields.io/npm/l/eslint-plugin-ime-safe-form)](./LICENSE)

ESLint plugin to enforce IME-safe key-event handling for users who type with an IME (Input Method Editor).

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

There are three correct approaches for Enter / form submission:

```js
// ✅ Option 1: use the form's submit event (fires after composition ends — no guard needed)
form.addEventListener('submit', (e) => {
  e.preventDefault();
  submit();
});

// ✅ Option 2: require a modifier key — IME cannot be composing while Ctrl/Meta/Shift/Alt is held
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
});

// ✅ Option 3: guard with e.isComposing + e.keyCode === 229 (covers Safari)
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});

// ❌ Bad — breaks IME input
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});
```

`keypress` is **prohibited entirely** as it is deprecated.

The same IME race condition applies to non-Enter keys too — Escape, ArrowDown, and others can fire while IME composition is active. For those cases, use [`require-ime-safe-key-events`](#require-ime-safe-key-events).

**Safari note:** In Safari, `compositionend` fires before `keydown`, so `e.isComposing` is `false` when Enter confirms IME. The `e.keyCode === 229` check covers this gap. To require only `e.isComposing` (if Safari support is not needed), set `{ checkKeyCodeForSafari: false }` in the rule options.

**Custom guard functions:** If you extract the `isComposing` check into a shared helper, use the `guardFunctions` option to register the function name so the rule recognises it as an IME guard:

```js
const guardIsComposing = (e) => e.isComposing || e.keyCode === 229;

// eslint.config.js
rules: { 'ime-safe-form/require-ime-safe-submit': ['warn', { guardFunctions: ['guardIsComposing'] }] }
```

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

**Note:** The `recommended` config sets all three rules to `"warn"`. To treat violations as errors, configure them manually:

```js
rules: {
  'ime-safe-form/no-keypress-event': 'error',
  'ime-safe-form/require-ime-safe-submit': 'error',
  'ime-safe-form/require-ime-safe-key-events': 'error',
}
```

### Manual configuration

All three rules are independent and complementary:

- `no-keypress-event` — flags any use of the deprecated `keypress` event; suggests `keydown` instead
- `require-ime-safe-submit` — Enter key only; also suggests the form's `submit` event as an alternative
- `require-ime-safe-key-events` — all **non-Enter** keys (Escape, ArrowDown, Tab, etc.)

```js
import imeSafeForm from 'eslint-plugin-ime-safe-form';

export default [
  {
    plugins: { 'ime-safe-form': imeSafeForm },
    rules: {
      'ime-safe-form/no-keypress-event': 'warn',
      'ime-safe-form/require-ime-safe-submit': 'warn',
      'ime-safe-form/require-ime-safe-key-events': 'warn',
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
    'ime-safe-form/no-keypress-event': 'warn',
    'ime-safe-form/require-ime-safe-submit': 'warn',
    'ime-safe-form/require-ime-safe-key-events': 'warn',
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
| [`no-keypress-event`](#no-keypress-event) | Flags any use of the deprecated `keypress` event and suggests `keydown` instead | ✅ |
| [`require-ime-safe-submit`](#require-ime-safe-submit) | Flags Enter key checks in `keydown`/`keyup` without an `e.isComposing` guard; suggests the form's `submit` event as the primary alternative | ✅ |
| [`require-ime-safe-key-events`](#require-ime-safe-key-events) | Flags non-Enter key checks in `keydown`/`keyup` without an `e.isComposing` guard; use alongside `require-ime-safe-submit` for full key coverage | ✅ |

### no-keypress-event

Flags any use of the `keypress` event — `addEventListener('keypress', …)`, `element.onkeypress = …`, or JSX `onKeyPress` / `onkeypress` — and suggests replacing it with `keydown`. `keypress` is deprecated by the browser standard; it was always unreliable with IME input regardless of any `e.isComposing` guard.

See the [full rule documentation](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/no-keypress-event.md).

#### Detected patterns

- `element.addEventListener('keypress', handler)` — always flagged, including named function references
- `element.onkeypress = handler` — property assignment
- JSX `onKeyPress` / `onkeypress` props — flagged on all element types

### require-ime-safe-submit

Detects Enter key checks in `keydown`/`keyup` handlers that lack an `e.isComposing` guard and reports them with a suggestion to use the form's `submit` event or add an `e.isComposing` guard. Non-Enter key checks are not flagged by this rule.

See the [full rule documentation](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-submit.md) for options, JSX support, and Safari handling.

#### Detected patterns

- `element.addEventListener('keydown' | 'keyup', handler)` where the handler checks `e.key === 'Enter'` (or `e.keyCode === 13`, `e.code === 'Enter'`) **without** an `e.isComposing` guard or modifier key condition
- `element.onkeydown` / `element.onkeyup` assignments with Enter checks
- JSX `onKeyDown` / `onKeyUp` props on IME-capable elements with Enter checks

### require-ime-safe-key-events

Detects **non-Enter** key checks in `keydown`/`keyup` handlers that lack an `e.isComposing` guard. Use alongside `require-ime-safe-submit` for full key coverage. The two rules cover different key patterns, so the same underlying issue is never reported twice. A handler that contains both an Enter check and a non-Enter check — each unguarded — will receive one report from each rule, pointing to the same fix: add an `e.isComposing` guard.

See the [full rule documentation](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-key-events.md) for options, JSX support, and Safari handling.

#### Detected patterns

- `element.addEventListener('keydown' | 'keyup', handler)` where the handler checks a non-Enter key (`e.key === 'Escape'`, `e.key === 'Tab'`, etc.) **without** an `e.isComposing` guard or modifier key condition
- `element.onkeydown` / `element.onkeyup` assignments with non-Enter key checks
- JSX `onKeyDown` / `onKeyUp` props on IME-capable elements with non-Enter key checks
- `switch(e.key) { case 'Enter': ...; case 'Escape': ... }` — a switch containing any non-Enter case is flagged even when an Enter case is also present

## Development

```sh
# Install dependencies
npm install

# Sync generated source from package.json when needed
npm run sync-version

# Type-check
npm run typecheck

# Run tests (no build step needed)
npm test

# Build for publishing
npm run build
```

`src/version.ts` is auto-generated from `package.json` and committed to the repository. This keeps fresh clones and editor tooling working without a separate bootstrap step. `build`, `test`, and `typecheck` run `npm run sync-version` automatically to keep it in sync.

### Project structure

```
src/
  index.ts              # Plugin entry point
  version.ts            # Auto-generated from package.json and committed
  rules/
    key-event-rule.ts   # Shared rule factory (makeRuleCreate)
    require-ime-safe-submit.ts
    require-ime-safe-key-events.ts
scripts/
  sync-version.mjs      # Syncs src/version.ts from package.json
tests/
  require-ime-safe-submit.test.ts
  require-ime-safe-key-events.test.ts
docs/
  rules/
    require-ime-safe-submit.md
    require-ime-safe-key-events.md
dist/                   # Built output (generated by npm run build)
```

## License

MIT © Hiroya Uga
