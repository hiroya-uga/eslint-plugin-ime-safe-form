# require-ime-safe-submit

Disallow IME-unsafe Enter key event handlers. Require an `e.isComposing` guard in `keydown`/`keyup` handlers with Enter key checks, or use the form's `submit` event instead.

> [!NOTE]
> If you need to guard key events beyond Enter (such as `Escape` or arrow keys), use [`require-ime-safe-key-events`](./require-ime-safe-key-events.md) instead.

## Rule Details

When a `keydown` or `keyup` handler checks for the Enter key without guarding against IME composition, users typing with an IME experience broken input. Pressing Enter to confirm IME candidates fires `keydown` before `compositionend`, which triggers the handler mid-composition.

Non-Enter key checks (e.g. `e.key === 'Escape'`) are not flagged by this rule. Use [`require-ime-safe-key-events`](./require-ime-safe-key-events.md) to cover those cases.

This rule requires one of three correct approaches:

1. **Form `submit` event** — fires only after composition completes; no guard needed
2. **Modifier key condition** — when a modifier key (`Ctrl`, `Meta`, `Shift`, `Alt`) is required alongside the Enter check, IME composition cannot be active; no guard is needed
3. **`e.isComposing` guard** — skip the handler body while IME composition is in progress

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

// switch statement with Enter case
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Enter': submit(); break;
  }
});

// legacy keyCode / which
input.addEventListener('keydown', (e) => {
  if (e.keyCode === 13) submit();
});

// onkeydown assignment
input.onkeydown = (e) => {
  if (e.key === 'Enter') submit();
};

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

// JSX — lowercase attribute name (used with Web Components and non-React frameworks)
<input onkeydown={(e) => { if (e.key === 'Enter') submitForm(); }} />
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

// ✅ Multiple modifiers with || are also recognized
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
});

// ✅ Multiple modifiers with && — requiring both is also safe
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey && e.metaKey)) submit();
});

// ✅ Outer if with modifier is also recognized
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

// ✅ e.isComposing alone — when checkKeyCodeForSafari: false is set
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') submit();
});

// ✅ Non-Enter key checks are not flagged by this rule
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog();
});
```

```jsx
// ✅ JSX — isComposing + keyCode 229 guard
<input onKeyDown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submitForm(); }} />

// ✅ React synthetic event — e.nativeEvent.isComposing works identically
<input onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return; if (e.nativeEvent.key === 'Enter') submitForm(); }} />

// ✅ JSX — onSubmit is correct
<form onSubmit={(e) => { e.preventDefault(); submitForm(); }}>
  ...
</form>

// ✅ JSX — non-IME-capable element; no guard needed (Enter checks on div/button do not affect IME input)
<div onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
```

## Detected Patterns

| Pattern | Example |
|---|---|
| `addEventListener('keydown' \| 'keyup', handler)` with Enter check | `el.addEventListener('keydown', e => { if (e.key === 'Enter') … })` |
| `onkeydown` / `onkeyup` property assignment with Enter check | `el.onkeydown = e => { if (e.key === 'Enter') … }` |
| JSX `onKeyDown` / `onKeyUp` prop on IME-capable elements with Enter check | `<input onKeyDown={e => { if (e.key === 'Enter') … }} />` |
| JSX `onkeydown` / `onkeyup` prop on IME-capable elements with Enter check | `<input onkeydown={e => { if (e.key === 'Enter') … }} />` |
| `e.key` / `e.code` comparison to `'Enter'` | `if (e.key === 'Enter') …` / `if (e.key !== 'Enter') return` |
| Legacy `e.keyCode` / `e.which` comparison to `13` | `if (e.keyCode === 13) …` / `if (e.keyCode !== 13) return` |
| `switch` on `e.key` / `e.code` / `e.keyCode` / `e.which` with `'Enter'` / `13` case | `switch(e.key) { case 'Enter': … }` |

### IME-capable elements (JSX only)

The JSX patterns (`onKeyDown`, `onKeyUp`, `onkeydown`, `onkeyup`) are only checked on elements where IME input is possible. Key checks on other elements (such as `<div>` or `<button>`) are not flagged.

| Element | Flagged by default |
|---|---|
| `<input>`, `<textarea>` | Yes |
| Any element with `contentEditable` / `contenteditable` (not `"false"`, `{false}`, or `{'false'}`) | Yes |
| PascalCase components (e.g. `<MyInput>`, `<UI.Input>`) | Yes (rendered output unknown) — configurable via [`jsxComponents`](#jsxcomponents) |
| Custom elements (e.g. `<sl-input>`, `<my-text-field>`) | No — configurable via [`customElements`](#customelements) |
| `<select>` | No (uses a dropdown picker; IME text input does not apply) |
| Other elements (`<div>`, `<button>`, `<span>`, …) | No |

### Not flagged

| Pattern | Reason |
|---|---|
| Non-Enter key checks (`e.key === 'Escape'`, `e.key === 'ArrowDown'`, etc.) | This rule is Enter-key specific — use [`require-ime-safe-key-events`](./require-ime-safe-key-events.md) for other keys |
| `e.isComposing \|\| e.keyCode === 229` guard in `keydown`/`keyup` | Default — covers both standard browsers and Safari |
| `!e.isComposing && e.keyCode !== 229` in blocking position (inline or wrapping) | De Morgan equivalent of the combined guard — the Enter key check must be inside the condition or its consequent body |
| `e.nativeEvent.isComposing \|\| e.nativeEvent.keyCode === 229` (React synthetic event) | React wraps the native event; `nativeEvent.isComposing` is equivalent to the native property |
| `e.isComposing` guard alone (with `checkKeyCodeForSafari: false`) | Author opted out of Safari check |
| `if (guardFn(e)) return;` (with `guardFunctions` option) | Guard function declared as an IME-safe guard; must appear before the key check it guards (and be first when nested inside a key-check if-body) |
| Enter check combined with a modifier via `&&` (`e.ctrlKey`, `e.metaKey`, `e.shiftKey`, `e.altKey`) | IME cannot be composing while a modifier key is held |
| Outer `if` whose test is a positive modifier expression, Enter check inside the body | Same reasoning — modifier held means no IME composition |
| Enter check inside a nested function | Out of scope for the keydown handler |
| Named function reference (`addEventListener('keydown', fn)`) | Cannot statically analyze external function bodies |
| JSX key check on non-IME-capable element (`<div>`, `<button>`, etc.) | Element cannot receive IME input |

### Known limitations

- **Ternary `isComposing` guard is not recognized.** Only `IfStatement` tests are checked. `e.isComposing ? null : (e.key === 'Enter' && submit())` will be flagged even though it is IME-safe. Use an `if` statement instead.
- **`!==`/`!=` patterns in a block body are detected but not in isolation.** If the entire handler never reaches the target code after the key check, the flag may be a false positive. Use `// eslint-disable-next-line` for those rare cases.
- **`isComposing` without early exit is not a guard.** The rule only recognises an `if (e.isComposing)` block as a guard when the consequent exits unconditionally (`return` or `throw`). `if (e.isComposing) console.log("composing")` does not qualify — subsequent key checks are still flagged. Always pair the guard with `return` or `throw`.
- **Destructured event parameters are not detected.** If the event object is destructured in the handler signature, the rule cannot see the key check and will not flag it. Write the handler as `(e) => { if (e.key === 'Enter') … }` rather than `({ key }) => { if (key === 'Enter') … }`.

  ```js
  // ⚠ Not flagged — use eslint-disable if intentional, or rewrite with (e) =>
  input.addEventListener('keydown', ({ key }) => {
    if (key === 'Enter') submit(); // missed by the rule
  });
  ```

- **`addEventListener` and `onkeydown =` do not scope by element type.** The rule cannot determine the element the handler is attached to at static analysis time. Even if the handler is on a `<div>`, it will be flagged. Only JSX patterns benefit from element-type scoping.

- **`guardFunctions` trusts the listed functions, but requires a recognised call form.** The rule cannot inspect the body of the guard function, but it does enforce that the call appears as `if (guardFn(e)) return;` — with the event parameter as the only argument, no negation, no compound `&&` conditions, and an early exit (`return` or `throw`) in the if-body. At the top level of the handler body, the guard must appear before the key check it protects. Nested inside a key-check if-body, the guard must be the first statement (e.g. `if (e.key === 'Enter') { if (guardFn(e)) return; … }`); placing any statement before it is treated as unsafe. Any function in `guardFunctions` suppresses `requireKeyCode229` as well as `requireImeSafeSubmit`. Make sure the guard function handles both `e.isComposing` and `e.keyCode === 229` if Safari support is needed.

## Options

### `guardFunctions` (default: `[]`)

If your codebase extracts the `isComposing` check into a shared helper, list those function names here. The rule will treat a call matching `if (guardFn(e)) return;` — appearing before the guarded key check at the top level of the handler body, or as the **first** statement inside a key-check if-body — as an equivalent IME guard and will not flag the handler.

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
// ✅ Recognized as an IME guard — no error
const guardIsComposing = (e) => e.isComposing || e.keyCode === 229;

input.addEventListener('keydown', (e) => {
  if (guardIsComposing(e)) return;
  if (e.key === 'Enter') submit();
});
```

The guard call must match a recognised form:

- ✅ `if (guardIsComposing(e)) return;` — recognized (standalone)
- ✅ `const ready = true; if (guardIsComposing(e)) return; if (e.key === 'Enter') submit();` — recognized (top-level guard still appears before the guarded key check)
- ✅ `if (e.key === 'Enter') { if (guardIsComposing(e)) return; submit(); }` — recognized (first statement inside a key-check if-body)
- ❌ `if (e.key === 'Enter') { submit(); if (guardIsComposing(e)) return; }` — guard is not first, not recognized
- ❌ `if (!guardIsComposing(e)) return;` — negated, not recognized
- ❌ `if (guardIsComposing(e) && other) return;` — compound `&&`, not recognized (may skip guard for some composing cases)
- ❌ `if (guardIsComposing(state)) return;` — non-event argument, not recognized
- ❌ `if (guardIsComposing(e, state)) return;` — extra arguments, not recognized

> [!NOTE]
> The rule cannot inspect the body of the guard function. It trusts that any function listed in `guardFunctions` correctly handles IME state, including the Safari `keyCode === 229` case. The `requireKeyCode229` check is skipped for these handlers.

### `jsxComponents`

Controls how PascalCase components and dot-notation components (e.g. `<MyInput>`, `<UI.Input>`) are treated in JSX.

| Property | Type | Default | Description |
|---|---|---|---|
| `default` | `'check' \| 'ignore'` | `'check'` | Default behavior for components not in either list |
| `allowComponents` | `string[]` | `[]` | Components to never flag (overrides `default: 'check'`) |
| `disallowComponents` | `string[]` | `[]` | Components to always flag (overrides `default: 'ignore'`) |

```js
// eslint.config.js
export default [
  {
    ...imeSafeForm.configs.recommended,
    rules: {
      'ime-safe-form/require-ime-safe-submit': ['warn', {
        jsxComponents: {
          // Check all PascalCase components except known non-IME-capable ones (default behavior)
          allowComponents: ['ComboBox', 'NavigationMenu', 'UI.Input'],
        },
      }],
    },
  },
];
```

```js
// Opt out of checking all PascalCase components, then explicitly check specific ones
rules: {
  'ime-safe-form/require-ime-safe-submit': ['warn', {
    jsxComponents: {
      default: 'ignore',
      disallowComponents: ['MyTextInput', 'Form.TextArea'],
    },
  }],
},
```

```jsx
// ✅ Exempted — no warning even without an isComposing guard
<ComboBox onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
<UI.Input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
```

> [!NOTE]
> `jsxComponents` only affects JSX patterns. `addEventListener` and `onkeydown =` are not scoped by element type and are always checked.

### `customElements`

Controls how custom elements (lowercase hyphenated names such as `<sl-input>`, `<my-text-field>`) are treated in JSX. Custom elements are not flagged by default because the rule cannot determine their rendered output.

| Property | Type | Default | Description |
|---|---|---|---|
| `default` | `'check' \| 'ignore'` | `'ignore'` | Default behavior for elements not in either list |
| `allowElements` | `string[]` | `[]` | Elements to never flag (overrides `default: 'check'`) |
| `disallowElements` | `string[]` | `[]` | Elements to always flag (overrides `default: 'ignore'`) |

```js
// Opt into checking all custom elements
rules: {
  'ime-safe-form/require-ime-safe-submit': ['warn', {
    customElements: {
      default: 'check',
    },
  }],
},
```

```js
// Flag only specific known text-input web components
rules: {
  'ime-safe-form/require-ime-safe-submit': ['warn', {
    customElements: {
      disallowElements: ['sl-input', 'md-filled-text-field'],
    },
  }],
},
```

```jsx
// ✅ Not flagged by default — custom elements are ignored unless configured
<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />

// ❌ Flagged when disallowElements includes 'sl-input'
<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
```

> [!NOTE]
> `customElements` only affects JSX patterns. `addEventListener` and `onkeydown =` are not scoped by element type and are always checked.

### `allowComponents` (default: `[]`) — deprecated

> [!WARNING]
> `allowComponents` is deprecated. Use [`jsxComponents.allowComponents`](#jsxcomponents) instead. Both options are merged when used together.

PascalCase JSX components (e.g. `<MyInput>`) are flagged by default because their rendered output is unknown. If a component is guaranteed not to receive IME input (for example, a custom button or a navigation widget), list it here to suppress the warning.

Dot-notation components (e.g. `<UI.Input>`, `<Form.Field>`) are also supported — use the full dot-separated name.

```js
// eslint.config.js (deprecated — prefer jsxComponents.allowComponents)
export default [
  {
    ...imeSafeForm.configs.recommended,
    rules: {
      'ime-safe-form/require-ime-safe-submit': ['warn', {
        allowComponents: ['ComboBox', 'NavigationMenu', 'UI.Input'],
      }],
    },
  },
];
```

> [!NOTE]
> `allowComponents` only affects JSX patterns. `addEventListener` and `onkeydown =` are not scoped by element type and are always checked.

### `checkKeyCodeForSafari` (default: `true`)

In Safari, `compositionend` fires **before** the final `keydown`, so `e.isComposing` is already `false` when Enter is pressed to confirm IME. Setting this option to `true` requires a `keyCode === 229`-equivalent guard that covers this Safari case, in addition to the `isComposing` guard:

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

With `checkKeyCodeForSafari: true`, the guard for Enter key checks must cover Safari's event order. Two equivalent forms are accepted:

```js
// ✅ Standard form — e.isComposing || e.keyCode === 229 (pure early-exit guard)
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});

// ✅ De Morgan form — !e.isComposing && e.keyCode !== 229 in a wrapping condition
//    (key check inside the if-body; equivalent to the standard form by De Morgan's law)
input.addEventListener('keydown', (e) => {
  if (!e.isComposing && e.keyCode !== 229) {
    if (e.key === 'Enter') submit();
  }
});

// ✅ De Morgan form — inline (key check is part of the same condition)
input.addEventListener('keydown', (e) => {
  if (!e.isComposing && e.keyCode !== 229 && e.key === 'Enter') submit();
});

// ❌ Flagged — e.isComposing alone misses Safari's event order
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') submit();
});

// ❌ Flagged — reversed early-exit guard: exits when NOT composing,
//    so the key check runs while IME is active
input.addEventListener('keydown', (e) => {
  if (!e.isComposing && e.keyCode !== 229) return;
  if (e.key === 'Enter') submit();
});
```

> [!NOTE]
> The De Morgan form is only recognized when the Enter key check is **inside** the `if (!e.isComposing && e.keyCode !== 229)` block (wrapping) or is part of the same condition (inline). A `!e.isComposing && e.keyCode !== 229` guard that protects a different key branch (e.g. Escape) does not cover a separate Enter check.

> [!NOTE]
> `e.keyCode` is deprecated but remains the only reliable way to detect IME composition in Safari's event order up to and including Safari 16 (WebKit). Versions from Safari 16.4 onward have partially fixed this, but the behaviour is inconsistent across platforms. Set `checkKeyCodeForSafari: false` if Safari support is not a concern — `e.isComposing` alone will then be accepted.

## When Not to Use

If your application intentionally intercepts Enter key during IME composition (rare), you can disable this rule inline:

```js
// eslint-disable-next-line ime-safe-form/require-ime-safe-submit
input.addEventListener('keydown', handler);
```

## Further Reading

- [MDN — compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [MDN — KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
- [MDN — HTMLFormElement: submit event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event)
- [MDN — keypress event (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event)
