# CLAUDE.md

## Project Overview

**Package name:** `eslint-plugin-ime-safe-form`

Three rules, all included in `recommended`:

| Rule | Scope |
|---|---|
| `ime-safe-form/require-ime-safe-submit` | Enter key checks in `keydown`/`keyup` — suggests `e.isComposing` guard or form `submit` event |
| `ime-safe-form/require-ime-safe-key-events` | Non-Enter key checks in `keydown`/`keyup` — requires `e.isComposing` guard |
| `ime-safe-form/no-keypress-event` | Any `keypress` event usage — prohibited unconditionally (including named function references) |

An ESLint plugin that enforces IME-safe key-event handling. Users typing with an IME use it to input characters. Key events (`keydown`, `keyup`) fire _before_ `compositionend`, so handlers that check key values can trigger mid-composition if they lack an `e.isComposing` guard.

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

Correct alternatives:

1. **`e.isComposing` guard** — skip the handler while IME is active (all key checks)
2. **Form `submit` event** — fires only _after_ `compositionend` (Enter/submission only; accepted by `require-ime-safe-submit`)
3. **Modifier key condition** — `Ctrl`/`Meta`/`Shift`/`Alt` cannot be held during IME composition

`keypress` is prohibited unconditionally: it is deprecated and unreliable for IME regardless of any guard.

## Rule Logic

Rules share a factory in [src/rules/key-event-rule.ts](src/rules/key-event-rule.ts) via `makeRuleCreate`. Detection helpers are in [src/rules/helpers.ts](src/rules/helpers.ts).

- [src/rules/require-ime-safe-submit.ts](src/rules/require-ime-safe-submit.ts) — Enter-key rule; uses `containsEnterKey*` helpers
- [src/rules/require-ime-safe-key-events.ts](src/rules/require-ime-safe-key-events.ts) — non-Enter rule; uses `containsNonEnterKey*` helpers
- [src/rules/no-keypress-event.ts](src/rules/no-keypress-event.ts) — standalone; flags any `keypress` event usage unconditionally (no handler inspection)

### What triggers a report

| Rule | Event | Condition for flagging |
|---|---|---|
| `require-ime-safe-submit` | `keydown` / `keyup` | Enter key check found AND no `e.isComposing` guard |
| `require-ime-safe-submit` | `keydown` / `keyup` | Enter key check found AND no modifier key condition |
| `require-ime-safe-key-events` | `keydown` / `keyup` | Non-Enter key check found AND no `e.isComposing` guard |
| `no-keypress-event` | `keypress` | Event name itself (unconditional — handler body is not inspected) |

### Message IDs

`require-ime-safe-submit` and `require-ime-safe-key-events` share:
- `requireImeSafeSubmit` — keydown/keyup without isComposing guard
- `requireKeyCode229` — isComposing guard present but missing Safari `keyCode === 229` check

`no-keypress-event` uses its own:
- `keypressDeprecated` — any keypress event usage

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

### Switch statement detection asymmetry

Two helpers detect `switch` statements, and they differ intentionally:

- **`isEnterKeySwitchStatement`** — checks both the discriminant (`e.key`, `e.keyCode`, etc.) **and** the case values (must be `'Enter'` or `13`). Used by `containsEnterKeyCheck` for the Safari `keyCode === 229` check, which is only relevant when an Enter key is actually handled.
- **`isKeyCheckSwitchStatement`** — checks the discriminant **only**. Any `switch(e.key)` triggers it regardless of which keys are cased. Used by `containsKeyCheck` because the rule flags *all* key checks in keydown/keyup without an isComposing guard, not just Enter.

### AST walking

`walkAst()` traverses handler bodies but stops at nested function boundaries (`FUNCTION_TYPES`). This prevents false positives from Enter checks inside `setTimeout` callbacks or similar.

### `isComposing` guard detection

The main exported helpers for guard-aware detection are:

- `containsEnterKeyCheckOutsideIsComposingGuard` — walks the handler body and returns `true` if an Enter key check exists _outside_ any valid `isComposing` guard. Used by `require-ime-safe-submit`.
- `containsNonEnterKeyCheckOutsideIsComposingGuard` — same logic for non-Enter keys. Used by `require-ime-safe-key-events`.
- `containsKeyCheckOutsideIsComposingGuard` — covers all key checks (used internally for keypress).

`hasIsComposingCheck()` is still exported as a lower-level helper and recognizes the following guard forms:
- `if (e.isComposing) return;` — pure guard with early exit
- `if (!e.isComposing && e.key === 'Enter') …` — inline pattern
- `if (e.key === 'Enter' && !e.isComposing) …` — inline (reversed order)
- `if (!e.isComposing) { … }` — wrapping pattern containing the key check

A guard must contain an early exit (`return` or `throw`) in its consequent to be recognized (except for inline and wrapping patterns where the key check itself is scoped inside the guard).

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

## Release Process

npm publish is handled automatically by GitHub Actions (`.github/workflows/publish.yml`).
Publishing a GitHub Release triggers the workflow: typecheck → test → `npm publish --provenance`.

Steps:

1. On the release branch, bump the version in `package.json` and commit: `git commit -m "Release vX.Y.Z"`
2. Merge the release branch into `main` via pull request (direct push to `main` is blocked by branch protection)
3. Once merged, create and push a tag: `git tag vX.Y.Z && git push --tags`
4. Create a GitHub Release from the tag — Actions publishes to npm automatically

Version conventions:
- **patch** (x.x.Z) — bug fixes, false positive corrections
- **minor** (x.Y.0) — new features, new rule options
- **major** (X.0.0) — breaking changes

## Key Design Decisions

- **`keypress` is always banned** even with `isComposing` guard, because `keypress` is deprecated and there is no reason to use it for new code.
- **Named function references are not flagged** — static analysis of external function bodies is out of scope.
- **`e.isComposing` must appear in an `IfStatement` test** (not just referenced anywhere) to avoid false negatives where `isComposing` is logged or stored but not used as a guard. Ternary (`? :`) `isComposing` guards are not recognised — this is a known limitation documented in the rule docs.
- **`!==` / `!=` are also detected** as Enter key checks, covering the early-return idiom (`if (e.key !== 'Enter') return; submit()`). Both equality and inequality operators have the same IME race condition.
- The plugin uses `export =` (compiled to `module.exports`) — this is standard for ESLint plugins and ensures compatibility with both `require()` and ESM `import`.

## File Structure

```
src/
  index.ts                           # Plugin entry point and configs
  version.ts                         # Generated from package.json before build
  rules/
    helpers.ts                       # Shared AST helpers and detection logic
    key-event-rule.ts                # Shared rule factory (makeRuleCreate)
    require-ime-safe-submit.ts       # Enter-key rule
    require-ime-safe-key-events.ts   # Non-Enter key rule
    no-keypress-event.ts             # keypress prohibition rule
tests/
  require-ime-safe-submit.test.ts    # RuleTester tests
  require-ime-safe-key-events.test.ts
  no-keypress-event.test.ts
docs/
  rules/
    require-ime-safe-submit.md       # User-facing rule documentation
    require-ime-safe-key-events.md
    no-keypress-event.md
dist/                                # Built output (git-ignored, generated by build)
```

## Coding Rules

The following rules apply to all source code under `src/`:

- **`eqeqeq`** — Always use strict equality (`===` / `!==`). Never use `==` or `!=`.
- **`strict-boolean-expressions`** — Non-boolean values must not appear in boolean contexts. Use explicit checks instead of truthy/falsy coercion.
  - NG: `if (!node)`, `if (!eventArg)`
  - OK: `if (node === null || node === undefined)`, `if (eventArg === undefined)`
- **No non-null assertions (`!`)** — Do not use TypeScript's postfix `!` or `as Type` to bypass nullable types. Use explicit null/undefined guards.
- **Named parameters for multi-argument functions** — Functions that accept two or more parameters must use a destructured object parameter.
  - NG: `(a, b, c) => {}`
  - OK: `({ a, b, c }) => {}`
- **Braces required on `if` statements** — Never omit braces, even for single-line bodies. Arrow function expression bodies are exempt.
- **Return type inference** — Omit explicit return type annotations where TypeScript can infer them. Exception: recursive functions must annotate their return type.
- **`no-shadow`** — Avoid variable/parameter names that shadow an identifier from an outer scope. When destructuring inside a nested function, rename the bindings if they clash with outer names (e.g. `{ left: lhs, right: rhs }`).
- **No single-character variable names** — Use descriptive names even for short-lived callback parameters. Prefer `prop` over `p`, `ifNode` over `n`, `switchCase` over `c`.
