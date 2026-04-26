# require-ime-safe-submit

Require IME-safe form submission. Disallow key checks in `keydown`/`keyup` without an `e.isComposing` guard, and prohibit `keypress` entirely.

## Rule Details

When a `keydown` or `keyup` handler checks a key property (`e.key`, `e.code`, `e.keyCode`, `e.which`) without guarding against IME composition, users typing with an IME experience broken input. For example, pressing Enter to confirm IME candidates fires `keydown` before `compositionend`, and pressing Escape to cancel IME input fires `keydown` while `e.isComposing` is still `true` — both can trigger unintended side effects.

This rule requires one of three correct approaches:

1. **Form `submit` event** — fires only after composition completes; no guard needed
2. **Modifier key condition** — when a modifier key (`Ctrl`, `Meta`, `Shift`, `Alt`) is required alongside the key check, IME composition cannot be active; no guard is needed
3. **`e.isComposing` guard** — skip the handler body while IME composition is in progress

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

// Non-Enter key checks have the same IME race condition
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog(); // fires during IME composition — Escape cancels the candidate
});
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown': navigate(); break; // fires during IME candidate navigation
  }
});

// keypress — always prohibited (deprecated event)
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submit();
});

// keypress with isComposing — still prohibited
input.addEventListener('keypress', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') submit();
});

// Modifier negation is not a guard — IME Enter has shiftKey === false, so !e.shiftKey is true
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) submit();
});

// OR with modifier is not a guard — plain Enter (no modifier) still fires
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.ctrlKey) submit();
});
```

```jsx
// JSX — onKeyDown without isComposing guard on an IME-capable element
<input onKeyDown={(e) => { if (e.key === 'Enter') submitForm(); }} />

// JSX — onKeyPress always prohibited
<input onKeyPress={(e) => { if (e.key === 'Enter') submitForm(); }} />
```

### Examples of **correct** code

```js
/* eslint ime-safe-form/require-ime-safe-submit: "warn" */

// ✅ Option 1: use the form's submit event (fires after composition ends — no guard needed)
form.addEventListener('submit', (e) => {
  e.preventDefault();
  submit();
});

// ✅ Option 2: modifier key — IME cannot be composing when Ctrl/Meta/Shift/Alt is held
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) submit();
});

// ✅ Multiple modifiers with || are also recognised
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
});

// ✅ Outer if with modifier is also recognised
input.addEventListener('keydown', (e) => {
  if (e.ctrlKey) {
    if (e.key === 'Enter') submit();
  }
});

// ✅ Option 3: e.isComposing + e.keyCode === 229 guard (covers Safari)
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});

// ✅ Non-Enter key with isComposing guard
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
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

// ✅ JSX — non-IME-capable element; no guard needed (key checks on div/button do not affect IME input)
<div onKeyDown={(e) => { if (e.key === 'Escape') closeDialog(); }} />
<button onKeyDown={(e) => { if (e.key === 'ArrowDown') navigate(); }} />
```

## Detected Patterns

| Pattern | Example |
|---|---|
| `addEventListener('keydown' \| 'keyup', handler)` | `el.addEventListener('keydown', e => { if (e.key === '…') … })` |
| `addEventListener('keypress', handler)` | Always flagged (deprecated event) |
| `onkeydown` / `onkeyup` / `onkeypress` property assignment | `el.onkeydown = e => { if (e.key === '…') … }` |
| JSX `onKeyDown` / `onKeyUp` prop on IME-capable elements | `<input onKeyDown={e => { if (e.key === '…') … }} />` |
| JSX `onKeyPress` prop | Always flagged (deprecated event) |
| `e.key` / `e.code` comparison (any value) | `if (e.key === 'Enter') …` / `if (e.key !== 'Escape') return` |
| Legacy `e.keyCode` / `e.which` comparison (any value) | `if (e.keyCode === 13) …` / `if (e.keyCode !== 13) return` |
| `switch` on `e.key` / `e.code` / `e.keyCode` / `e.which` | `switch(e.key) { case 'Enter': … }` |

### IME-capable elements (JSX only)

The JSX patterns (`onKeyDown`, `onKeyUp`, `onKeyPress`) are only checked on elements where IME input is possible. Key checks on other elements (such as `<div>` or `<button>`) are not flagged.

| Element | Flagged |
|---|---|
| `<input>`, `<textarea>`, `<select>` | Yes |
| Any element with `contentEditable` / `contenteditable` (not `"false"`) | Yes |
| PascalCase components (e.g. `<MyInput>`) | Yes (rendered output unknown) |
| Other elements (`<div>`, `<button>`, `<span>`, …) | No |

Use the [`allowComponents`](#allowcomponents-default-) option to exempt specific PascalCase components you know are not IME-capable.

### Not flagged

| Pattern | Reason |
|---|---|
| `e.isComposing \|\| e.keyCode === 229` guard in `keydown`/`keyup` | Default — covers both standard browsers and Safari |
| `e.isComposing` guard alone (with `checkKeyCodeForSafari: false`) | Author opted out of Safari check |
| Guard function call in `IfStatement` (with `guardFunctions` option) | Function is declared as an equivalent IME guard |
| Key check combined with a modifier via `&&` (`e.ctrlKey`, `e.metaKey`, `e.shiftKey`, `e.altKey`) | IME cannot be composing while a modifier key is held |
| Outer `if` whose test is a positive modifier expression, key check inside the body | Same reasoning — modifier held means no IME composition |
| Key check inside a nested function | Out of scope for the keydown handler |
| Named function reference (`addEventListener('keydown', fn)`) | Cannot statically analyze external function bodies |
| JSX key check on non-IME-capable element (`<div>`, `<button>`, etc.) | Element cannot receive IME input |

### Known limitations

- **Ternary `isComposing` guard is not recognised.** Only `IfStatement` tests are checked. `e.isComposing ? null : (e.key === 'Enter' && submit())` will be flagged even though it is IME-safe. Use an `if` statement instead.
- **`!==`/`!=` patterns in a block body are detected but not in isolation.** If the entire handler never reaches the target code after the key check, the flag may be a false positive. Use `// eslint-disable-next-line` for those rare cases.
- **`isComposing` guard without early exit is not verified.** The rule recognises any `IfStatement` whose condition references `e.isComposing`, regardless of whether the body actually returns or throws. Code like `if (e.isComposing) console.log("composing")` (no `return`) satisfies the check even though it does not prevent key processing. Always pair the guard with `return` (or equivalent).
- **Destructured event parameters are not detected.** If the event object is destructured in the handler signature, the rule cannot see the key check and will not flag it. Write the handler as `(e) => { if (e.key === 'Enter') … }` rather than `({ key }) => { if (key === 'Enter') … }`.

  ```js
  // ⚠ Not flagged — use eslint-disable if intentional, or rewrite with (e) =>
  input.addEventListener('keydown', ({ key }) => {
    if (key === 'Enter') submit(); // missed by the rule
  });
  ```

- **`addEventListener` and `onkeydown =` do not scope by element type.** The rule cannot determine the element the handler is attached to at static analysis time. Even if the handler is on a `<div>`, it will be flagged. Only JSX patterns benefit from element-type scoping.

## Options

### `guardFunctions` (default: `[]`)

If your codebase extracts the `isComposing` check into a shared helper, list those function names here. The rule will treat a call to any of these functions inside an `if` statement as an equivalent IME guard, and will not flag the handler.

```js
// eslint.config.js
export default [
  {
    ...imeSafeForm.configs.recommended,
    rules: {
      'ime-safe-form/require-ime-safe-submit': ['warn', {
        guardFunctions: ['guardIsComposing'],
      }],
    },
  },
];
```

```js
// ✅ Recognised as an IME guard — no error
const guardIsComposing = (e) => e.isComposing || e.keyCode === 229;

input.addEventListener('keydown', (e) => {
  if (guardIsComposing(e)) return;
  if (e.key === 'Enter') submit();
});
```

Negated calls (`if (!guardIsComposing(e))`) and calls inside compound conditions (`&&`, `||`) are also recognised.

> [!NOTE]
> The rule cannot inspect the body of the guard function. It trusts that any function listed in `guardFunctions` correctly handles IME state, including the Safari `keyCode === 229` case. The `requireKeyCode229` check is skipped for these handlers.

> [!NOTE]
> `guardFunctions` has no effect on `keypress` handlers — `keypress` is prohibited regardless of any guard.

### `allowComponents` (default: `[]`)

PascalCase JSX components (e.g. `<MyInput>`) are flagged by default because their rendered output is unknown. If a component is guaranteed not to receive IME input (for example, a custom button or a navigation widget), list it here to suppress the warning.

```js
// eslint.config.js
export default [
  {
    ...imeSafeForm.configs.recommended,
    rules: {
      'ime-safe-form/require-ime-safe-submit': ['warn', {
        allowComponents: ['ComboBox', 'NavigationMenu'],
      }],
    },
  },
];
```

```jsx
// ✅ Exempted — no warning even without an isComposing guard
<ComboBox onKeyDown={(e) => { if (e.key === 'ArrowDown') navigate(); }} />
```

> [!NOTE]
> `allowComponents` only affects JSX patterns. `addEventListener` and `onkeydown =` are not scoped by element type and are always checked.

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

With `checkKeyCodeForSafari: true`, only the combined guard is accepted for Enter key checks:

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

> [!NOTE]
> The `keyCode === 229` requirement only applies when an Enter key check is present. Non-Enter key checks (e.g. `e.key === 'Escape'`) are not subject to this additional requirement, because the Safari event-order issue is specific to Enter confirming IME candidates.

> [!NOTE]
> `e.keyCode` is deprecated but remains the only reliable way to detect IME composition in Safari's event order. Set `checkKeyCodeForSafari: false` if Safari support is not a concern — `e.isComposing` alone will then be accepted.

## When Not to Use

If your application intentionally intercepts keys during IME composition (rare), you can disable this rule inline:

```js
// eslint-disable-next-line ime-safe-form/require-ime-safe-submit
input.addEventListener('keydown', handler);
```

## Further Reading

- [MDN — compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [MDN — KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
- [MDN — HTMLFormElement: submit event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event)
- [MDN — keypress event (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event)
