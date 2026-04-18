# CLAUDE.md

## Project Overview

**Package name:** `eslint-plugin-ime-safe-form`
**Rule:** `ime-safe-form/require-ime-safe-submit`

An ESLint plugin that prevents accidental form submission during IME (Input Method Editor) composition. Japanese, Chinese, Korean users use IME to input characters. Pressing Enter to confirm an IME candidate fires `keydown` _before_ `compositionend`, which causes form submission mid-input if the handler blindly checks `e.key === 'Enter'`.

## The Problem Being Solved

```js
// ❌ This breaks IME input: Enter confirms IME candidate AND submits the form
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});

// ❌ Also flagged: early-return pattern with !== is the same problem
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  submit();
});
```

The two correct alternatives enforced by the rule:

1. **`e.isComposing` guard** — skip the handler while IME is active
2. **Form `submit` event** — fires only _after_ `compositionend`

`keypress` is prohibited unconditionally: it is deprecated and unreliable for IME regardless of any guard.

## Rule Logic

The rule is in [src/rules/require-ime-safe-submit.ts](src/rules/require-ime-safe-submit.ts).

### What triggers a report

| Event | Condition for flagging |
|---|---|
| `keydown` / `keyup` | Enter key check found AND no `e.isComposing` guard in an `if` test |
| `keypress` | Enter key check found (always — `isComposing` does not exempt) |

### Two message IDs

- `requireImeSafeSubmit` — keydown/keyup without isComposing guard
- `keypressProhibited` — any keypress handler with an Enter check

### `checkHandler` function

Accepts `allowIsComposingGuard: boolean`:
- `true` for keydown/keyup: `hasIsComposingCheck()` can exempt the handler
- `false` for keypress: always flag if Enter check is found

### Enter key detection operators

`isEnterKeyBinaryExpression` matches **both equality and inequality** operators:
- `===` / `==` — direct Enter check
- `!==` / `!=` — early-return pattern (`if (e.key !== 'Enter') return; submit()`)

Both forms have the same IME race condition, so both are flagged.

### Detection patterns

Three handler patterns are detected:
1. `element.addEventListener('keydown' | 'keyup' | 'keypress', handler)` — `CallExpression`
2. `element.onkeydown = handler` / `onkeyup` / `onkeypress` — `AssignmentExpression`
3. JSX `onKeyDown` / `onKeyUp` / `onKeyPress` prop — `JSXAttribute`

Named function references (e.g. `addEventListener('keydown', handleFn)`) are intentionally not flagged — the handler body cannot be statically analyzed.

### AST walking

`walkAst()` traverses handler bodies but stops at nested function boundaries (`FUNCTION_TYPES`). This prevents false positives from Enter checks inside `setTimeout` callbacks or similar.

### `isComposing` guard detection

`hasIsComposingCheck()` looks for any `IfStatement` whose `test` contains a `MemberExpression` with property `isComposing`. This covers:
- `if (e.isComposing) return;`
- `if (!e.isComposing && e.key === 'Enter') …`
- `if (e.key === 'Enter' && !e.isComposing) …`
- Outer `if (!e.isComposing) { … }` wrapping an Enter check

## Plugin Entry Point

[src/index.ts](src/index.ts) exports two configs:

- `recommended` — flat config (ESLint 9), sets `plugins: { "ime-safe-form": plugin }`
- `recommended:legacy` — eslintrc-style (ESLint 8), sets `plugins: ["ime-safe-form"]`

## Development

```sh
npm test          # runs tests directly with tsx (no build needed)
npm run typecheck # tsc --noEmit
npm run build     # emit to dist/ (required before publishing)
```

No external test framework — uses Node.js built-in test runner with `tsx` for TypeScript support.

## Key Design Decisions

- **`keypress` is always banned** even with `isComposing` guard, because `keypress` is deprecated and there is no reason to use it for new code.
- **Named function references are not flagged** — static analysis of external function bodies is out of scope.
- **`e.isComposing` must appear in an `IfStatement` test** (not just referenced anywhere) to avoid false negatives where `isComposing` is logged or stored but not used as a guard. Ternary (`? :`) `isComposing` guards are not recognised — this is a known limitation documented in the rule docs.
- **`!==` / `!=` are also detected** as Enter key checks, covering the early-return idiom (`if (e.key !== 'Enter') return; submit()`). Both equality and inequality operators have the same IME race condition.
- The plugin uses `export =` (compiled to `module.exports`) — this is standard for ESLint plugins and ensures compatibility with both `require()` and ESM `import`.

## File Structure

```
src/
  index.ts                          # Plugin entry point and configs
  rules/
    require-ime-safe-submit.ts      # The only rule
tests/
  require-ime-safe-submit.test.ts   # RuleTester tests
docs/
  rules/
    require-ime-safe-submit.md      # User-facing rule documentation
dist/                               # Built output (git-ignored, generated by build)
```
