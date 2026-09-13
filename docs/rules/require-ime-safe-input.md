# require-ime-safe-input

Require an `isComposing` guard before rewriting a field's value in `input`/`beforeinput` handlers, or JSX `onChange`.

> [!NOTE]
> This rule is not part of `recommended` yet. It ships enabled-by-default-off so real-world usage can surface false positives before it's promoted.

## Rule Details

Rewriting `event.target.value` (or `event.currentTarget.value`) inside an `input`/`beforeinput` handler runs on every keystroke, including while an IME composition is still in progress. Because the composition candidate text is not yet committed, overwriting `value` mid-composition destroys the in-progress conversion — the user sees nothing break, but the characters they were composing are gone.

```js
// Every keystroke rewrites value, including mid-composition ones
input.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/[^0-9]/g, '');
});
```

An `e.isComposing` guard prevents this specific corruption, but it does not fully solve the underlying problem: once composition ends, `isComposing` is `false` again, so full-width digits (e.g. `４０`) typed via IME are still stripped by a naive `[^0-9]` filter on the very next `input` event. Fully IME-safe numeric input requires normalizing full-width characters to half-width *before* filtering, or moving the filter to `blur`/`compositionend` entirely. This rule only prevents the most disruptive case (rewriting mid-composition); the rest is left to documentation and code review — see [issue #8](https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/issues/8) for the full writeup and a live demo.

### Examples of **incorrect** code

```js
/* eslint ime-safe-form/require-ime-safe-input: "warn" */

// No isComposing guard
input.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/[^0-9]/g, '');
});

// beforeinput is also checked
input.addEventListener('beforeinput', (event) => {
  event.target.value = event.target.value.trim();
});

// currentTarget is also checked
input.addEventListener('input', (event) => {
  event.currentTarget.value = event.currentTarget.value.toUpperCase();
});

// oninput / onbeforeinput property assignment
input.oninput = (event) => {
  event.target.value = event.target.value.replace(/[^0-9]/g, '');
};

// Destructured event parameter
input.addEventListener('input', ({ target }) => {
  target.value = target.value.replace(/[^0-9]/g, '');
});

// isComposing is referenced but never used as a guard
input.addEventListener('input', ({ target, isComposing }) => {
  console.log(isComposing);
  target.value = target.value.replace(/[^0-9]/g, '');
});

// Guard placed after the write does not protect it
input.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/[^0-9]/g, '');
  if (event.isComposing) return;
});
```

```jsx
// JSX — onInput / onChange / onBeforeInput without an isComposing guard
<input onInput={(event) => { event.target.value = event.target.value.replace(/[^0-9]/g, ''); }} />
<input onChange={(event) => { event.target.value = event.target.value.trim(); }} />
<input onBeforeInput={(event) => { event.target.value = ''; }} />
```

### Examples of **correct** code

```js
/* eslint ime-safe-form/require-ime-safe-input: "warn" */

// isComposing guard with early exit
input.addEventListener('input', (event) => {
  if (event.isComposing) return;
  event.target.value = event.target.value.replace(/[^0-9]/g, '');
});

// Inverted (wrapping) guard
input.addEventListener('input', (event) => {
  if (!event.isComposing) {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
  }
});

// if/else — the write only runs on the non-composing branch
input.addEventListener('input', (event) => {
  if (event.isComposing) {
    // no-op while composing
  } else {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
  }
});

// Destructured parameter, including renamed target
input.addEventListener('input', ({ target, isComposing }) => {
  if (isComposing) return;
  target.value = target.value.replace(/[^0-9]/g, '');
});
input.addEventListener('input', ({ target: el, isComposing }) => {
  if (isComposing) return;
  el.value = el.value.replace(/[^0-9]/g, '');
});

// React synthetic event — e.nativeEvent.isComposing works identically
input.addEventListener('input', (event) => {
  if (event.nativeEvent.isComposing) return;
  event.target.value = event.target.value.trim();
});

// Bare `&&`/`||` short-circuit used as a one-line guard (no `if`)
input.addEventListener('input', (event) => {
  !event.isComposing && (event.target.value = event.target.value.trim());
});
input.addEventListener('input', (event) => {
  event.isComposing || (event.target.value = event.target.value.trim());
});

// Recommended alternative: move formatting off the input event entirely
input.addEventListener('compositionend', (event) => {
  event.target.value = format(event.target.value);
});
input.addEventListener('blur', (event) => {
  event.target.value = format(event.target.value);
});
```

```jsx
// JSX — isComposing guard
<input onInput={(event) => { if (event.isComposing) return; event.target.value = event.target.value.replace(/[^0-9]/g, ''); }} />

// JSX — non-IME-capable element; not flagged
<select onChange={(event) => { event.target.value = event.target.value.trim(); }} />
```

## Detected Patterns

| Pattern | Example |
|---|---|
| `addEventListener('input' \| 'beforeinput', handler)` rewriting `event.target.value` / `event.currentTarget.value` | `el.addEventListener('input', e => { e.target.value = ... })` |
| `element.oninput` / `element.onbeforeinput` property assignment | `el.oninput = e => { e.target.value = ... }` |
| JSX `onInput` / `onBeforeInput` / `onChange` prop (and lowercase `oninput`/`onbeforeinput`/`onchange`) on IME-capable elements | `<input onChange={e => { e.target.value = ... }} />` |
| Destructured event parameter | `({ target, isComposing }) => { target.value = ... }` |

### IME-capable elements (JSX only)

The JSX patterns are only checked on elements where IME input is possible, using the same element scoping as [`require-ime-safe-key-events`](./require-ime-safe-key-events.md#ime-capable-elements-jsx-only): `<input>`/`<textarea>`/`contentEditable` elements and PascalCase components are checked; `<select>`, custom elements, and other elements (`<div>`, `<button>`, ...) are not. Unlike `require-ime-safe-key-events`, this scoping is currently **not configurable** for this rule — `jsxComponents`/`customElements` options are not exposed.

### Not flagged

| Pattern | Reason |
|---|---|
| `addEventListener('change', handler)` / `element.onchange = handler` | The native DOM `change` event is out of scope for this rule — only `input`/`beforeinput` are checked outside of JSX |
| JSX `onChange` | Checked, unlike the native `change` event above — React maps `onChange` to the DOM `input` event |
| `blur` / `compositionend` handlers | Fire after composition ends; recommended alternative, out of scope entirely |
| `if (event.isComposing) { ... } else { write }` | The write only executes on the non-composing branch |
| `e.isComposing` guard placed after the value write | Does not protect a write that already ran |
| Bare `!isComposing && write` / `isComposing || write` (no `if`) | Same short-circuit semantics as the `if`-guarded forms |
| `e.nativeEvent.isComposing` (React synthetic event) | Equivalent IME guard |
| Value write inside a nested function | Out of scope for the original handler (function boundary) |
| Named function reference (`addEventListener('input', fn)`) | Cannot statically analyze external function bodies |
| JSX write on non-IME-capable element (`<select>`, `<div>`, etc.) | Element cannot receive IME input |

### Known limitations

- **Fixing the mid-composition write does not fix full-width digit leakage.** After `compositionend`, `isComposing` is `false` again, so a naive `[^0-9]` filter still strips full-width digits (`４０`) on the next `input` event. Normalize full-width characters to half-width before filtering, or move the filter to `blur`/`compositionend`.
- **Ternary `isComposing` guard is not recognized.** `IfStatement` tests and bare `&&`/`||` short-circuit guards are checked, but a ternary (`isComposing ? a : b`) is not, matching the other rules in this plugin.
- **Comparison-style guards are not recognized.** `event.isComposing` is only matched as a direct reference (optionally combined with `||`/`&&`); a comparison like `if (event.isComposing === true) return;` is not detected as a guard and will be flagged as a false positive.
- **Only the first function parameter is inspected**, and only a plain identifier or a top-level `ObjectPattern` destructure of `target`/`currentTarget`/`isComposing` (with optional renaming). Nested destructuring (e.g. `({ target: { value } }) => ...`) is not detected.
- **A local variable that aliases `event.target` inside the handler body is not tracked**, so a write through it is invisible to this rule:

  ```js
  // NOT flagged, even with zero guard — target is a body-level local, not the parameter itself
  input.addEventListener('input', (event) => {
    const target = event.target;
    target.value = target.value.trim();
  });

  // Same gap via a body-level destructure (as opposed to destructuring the parameter itself, which IS detected)
  input.addEventListener('input', (event) => {
    const { target } = event;
    target.value = target.value.trim();
  });
  ```

  Only `target`/`currentTarget`/`isComposing` bound directly in the parameter list (see the row above) are recognized; the rule does not perform data-flow/alias analysis on `VariableDeclaration`s inside the handler body.
- **Computed member access is not recognized.** `event.target['value'] = ...` and `event['isComposing']` are not matched — only the dot-access form (`event.target.value`, `event.isComposing`) is detected, on both the write side and the guard side.
- **No `guardFunctions` option.** Unlike `require-ime-safe-submit`/`require-ime-safe-key-events`, a shared guard helper extracted into its own function is not recognized here.

## Options

This rule has no options.

## When Not to Use

If your formatting logic is already IME-safe in a way this rule can't detect (for example, a shared guard helper), disable it inline:

```js
// eslint-disable-next-line ime-safe-form/require-ime-safe-input
input.addEventListener('input', handler);
```

## Further Reading

- [MDN — compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [MDN — KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
