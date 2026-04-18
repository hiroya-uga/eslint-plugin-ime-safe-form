# require-ime-safe-submit

Require IME-safe form submission. Disallow Enter key detection in `keydown`/`keyup` without an `e.isComposing` guard, and prohibit `keypress` entirely.

## Rule Details

When a `keydown` or `keyup` handler checks for the Enter key without guarding against IME composition, users typing with an IME experience broken input: pressing Enter to confirm IME candidates fires `keydown` before `compositionend`, causing accidental form submission mid-input.

This rule requires one of two correct approaches:

1. **`e.isComposing` guard** — skip the handler body while IME composition is in progress
2. **Form `submit` event** — fires only after composition completes; no guard needed

`keypress` is prohibited entirely because it is deprecated. Use `keydown` with an `e.isComposing` guard instead.

### Examples of **incorrect** code

```js
/* eslint ime-safe-form/require-ime-safe-submit: "warn" */

// No isComposing guard — breaks IME input
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});

// Early-return pattern (!==/!=) — same IME problem
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  submit();
});

// e.code is also detected
input.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') submit();
});

// switch statement
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Enter': submit(); break;
  }
});

// legacy keyCode / which
input.addEventListener('keydown', (e) => {
  if (e.keyCode === 13) submit();
});

// onkeydown / onkeyup assignment
input.onkeydown = (e) => {
  if (e.key === 'Enter') submit();
};

// keypress — always prohibited (deprecated event)
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submit();
});

// keypress with isComposing — still prohibited
input.addEventListener('keypress', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') submit();
});
```

```jsx
// JSX — onKeyDown without isComposing guard
<input onKeyDown={(e) => { if (e.key === 'Enter') submitForm(); }} />

// JSX — onKeyPress always prohibited
<input onKeyPress={(e) => { if (e.key === 'Enter') submitForm(); }} />
```

### Examples of **correct** code

```js
/* eslint ime-safe-form/require-ime-safe-submit: "warn" */

// ✅ Option 1: e.isComposing + e.keyCode === 229 guard (covers Safari)
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});

// ✅ Option 2: use the form's submit event
form.addEventListener('submit', (e) => {
  e.preventDefault();
  submit();
});

// ✅ keydown for non-submission purposes is fine
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog();
});

// ✅ e.isComposing alone — when checkKeyCodeForSafari: false is set
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') submit();
});
```

```jsx
// ✅ JSX — isComposing + keyCode 229 guard
<input onKeyDown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submitForm(); }} />

// ✅ JSX — onSubmit is correct
<form onSubmit={(e) => { e.preventDefault(); submitForm(); }}>
  ...
</form>
```

## Detected Patterns

| Pattern | Example |
|---|---|
| `addEventListener('keydown' \| 'keyup', handler)` | `el.addEventListener('keydown', e => { if (e.key === 'Enter') … })` |
| `addEventListener('keypress', handler)` | Always flagged (deprecated event) |
| `onkeydown` / `onkeyup` / `onkeypress` property assignment | `el.onkeydown = e => { if (e.key === 'Enter') … }` |
| JSX `onKeyDown` / `onKeyUp` prop | `<input onKeyDown={e => { if (e.key === 'Enter') … }} />` |
| JSX `onKeyPress` prop | Always flagged (deprecated event) |
| `e.code === 'Enter'` / `e.code !== 'Enter'` | `if (e.code === 'Enter') …` / `if (e.code !== 'Enter') return` |
| Legacy `keyCode === 13` / `which === 13` (and `!==` / `!=`) | `if (e.keyCode === 13) …` / `if (e.keyCode !== 13) return` |
| `switch` on `e.key` / `e.code` / `e.keyCode` / `e.which` | `switch(e.key) { case 'Enter': … }` |

### Not flagged

| Pattern | Reason |
|---|---|
| `e.isComposing \|\| e.keyCode === 229` guard in `keydown`/`keyup` | Default — covers both standard browsers and Safari |
| `e.isComposing` guard alone (with `checkKeyCodeForSafari: false`) | Author opted out of Safari check |
| Enter check inside a nested function | Out of scope for the keydown handler |
| Named function reference (`addEventListener('keydown', fn)`) | Cannot statically analyze external function bodies |

### Known limitations

- **Ternary `isComposing` guard is not recognised.** Only `IfStatement` tests are checked. `e.isComposing ? null : (e.key === 'Enter' && submit())` will be flagged even though it is IME-safe. Use an `if` statement instead.
- **`!==`/`!=` patterns in a block body are detected but not in isolation.** If the entire handler never reaches submission code after the Enter check, the flag may be a false positive. Use `// eslint-disable-next-line` for those rare cases.
- **`isComposing` guard without early exit is not verified.** The rule recognises any `IfStatement` whose condition references `e.isComposing`, regardless of whether the body actually returns or throws. Code like `if (e.isComposing) console.log("composing")` (no `return`) satisfies the check even though it does not prevent Enter processing. Always pair the guard with `return` (or equivalent).
- **Destructured event parameters are not detected.** If the event object is destructured in the handler signature, the rule cannot see the Enter key check and will not flag it. Write the handler as `(e) => { if (e.key === 'Enter') … }` rather than `({ key }) => { if (key === 'Enter') … }`.

  ```js
  // ⚠ Not flagged — use eslint-disable if intentional, or rewrite with (e) =>
  input.addEventListener('keydown', ({ key }) => {
    if (key === 'Enter') submit(); // missed by the rule
  });
  ```

## Options

### `checkKeyCodeForSafari` (default: `true`)

In Safari, `compositionend` fires **before** the final `keydown`, so `e.isComposing` is already `false` when Enter is pressed to confirm IME. Setting this option to `true` additionally requires `e.keyCode === 229` alongside `e.isComposing`:

```js
// eslint.config.js
export default [
  {
    ...imeSafeForm.configs.recommended,
    rules: {
      "ime-safe-form/require-ime-safe-submit": ["warn", { checkKeyCodeForSafari: true }],
    },
  },
];
```

With `checkKeyCodeForSafari: true`, only the combined guard is accepted:

```js
// ✅ Correct — covers both standard browsers and Safari
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});

// ❌ Flagged — e.isComposing alone misses Safari's event order
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') submit();
});
```

> **Note:** `e.keyCode` is deprecated but remains the only reliable way to detect IME composition in Safari's event order. Set `checkKeyCodeForSafari: false` if Safari support is not a concern — `e.isComposing` alone will then be accepted.

## When Not to Use

If your application intentionally intercepts Enter during IME composition (rare), you can disable this rule inline:

```js
// eslint-disable-next-line ime-safe-form/require-ime-safe-submit
input.addEventListener('keydown', handler);
```

## Further Reading

- [MDN — compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [MDN — KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
- [MDN — HTMLFormElement: submit event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event)
- [MDN — keypress event (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event)
