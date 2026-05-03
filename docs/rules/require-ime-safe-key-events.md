# require-ime-safe-key-events

Disallow IME-unsafe key event handlers for non-Enter keys. Require an `e.isComposing` guard in `keydown`/`keyup` handlers with non-Enter key checks.

> [!NOTE]
> If your main concern is Enter-driven form submission, use [`require-ime-safe-submit`](./require-ime-safe-submit.md) instead. That rule is Enter-key specific and also accepts the form's `submit` event as an alternative fix.

## Rule Details

When a `keydown` or `keyup` handler checks a non-Enter key (`Escape`, `Tab`, arrow keys, and so on) without guarding against IME composition, users typing with an IME can trigger those handlers mid-composition. For example, pressing Escape cancels IME candidates while `e.isComposing` is still `true`, and pressing ArrowDown can navigate the candidate list before composition ends.

Enter handling is intentionally out of scope for this rule. Use [`require-ime-safe-submit`](./require-ime-safe-submit.md) for Enter-specific checks.

This rule requires one of two correct approaches:

1. **Modifier key condition** — when a modifier key (`Ctrl`, `Meta`, `Shift`, `Alt`) is required alongside the key check, IME composition cannot be active; no guard is needed
2. **`e.isComposing` guard** — skip the handler body while IME composition is in progress

### Examples of **incorrect** code

```js
/* eslint ime-safe-form/require-ime-safe-key-events: "warn" */

// No isComposing guard — Escape can fire during IME composition
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog();
});

// Early-return pattern (!==/!=) — same IME problem
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  focusNext();
});

// e.code is also detected
input.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowDown') navigate();
});

// switch statement
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Escape': closeDialog(); break;
  }
});

// mixed switch: the non-Enter branch is still unsafe
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Enter': submit(); break;
    case 'Escape': closeDialog(); break;
  }
});

// default branch also covers non-Enter keys
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Enter': submit(); break;
    default: closeDialog();
  }
});

// legacy keyCode / which
input.addEventListener('keydown', (e) => {
  if (e.which === 27) closeDialog();
});

// onkeydown / onkeyup assignment
input.onkeydown = (e) => {
  if (e.key === 'Escape') closeDialog();
};

// Modifier negation is not a guard — plain Escape still fires
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !e.shiftKey) closeDialog();
});

// OR with modifier is not a guard — plain Escape (no modifier) still fires
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.ctrlKey) closeDialog();
});
```

```jsx
// JSX — onKeyDown without isComposing guard on an IME-capable element
<input onKeyDown={(e) => { if (e.key === 'Escape') closeDialog(); }} />

// JSX — lowercase attribute name (used with Web Components and non-React frameworks)
<input onkeydown={(e) => { if (e.key === 'Tab') focusNext(); }} />
```

### Examples of **correct** code

```js
/* eslint ime-safe-form/require-ime-safe-key-events: "warn" */

// Option 1: modifier key — IME cannot be composing when Ctrl/Meta/Shift/Alt is held
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.ctrlKey) closeAll();
});

// Multiple modifiers with || are also recognized
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) navigate();
});

// Multiple modifiers with && are also safe
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (e.ctrlKey && e.metaKey)) closeAll();
});

// Outer if with modifier is also recognized
input.addEventListener('keydown', (e) => {
  if (e.ctrlKey) {
    if (e.key === 'k') openPalette();
  }
});

// Option 2: isComposing guard
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Escape') closeDialog();
});

// keyCode === 229 is also accepted, though not required for this rule
input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Tab') focusNext();
});

// mixed switch: the guard covers both the Enter branch and the non-Enter branch
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  switch (e.key) {
    case 'Enter': submit(); break;
    case 'Escape': closeDialog(); break;
    default: break;
  }
});

// Enter-only switch is handled by require-ime-safe-submit, not this rule
input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Enter': submit(); break;
  }
});
```

```jsx
// JSX — isComposing guard
<input onKeyDown={(e) => { if (e.isComposing) return; if (e.key === 'Escape') closeDialog(); }} />

// React synthetic event — e.nativeEvent.isComposing works identically
<input onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Tab') focusNext(); }} />

// JSX — non-IME-capable element; no guard needed
<div onKeyDown={(e) => { if (e.key === 'Escape') closeDialog(); }} />
<button onKeyDown={(e) => { if (e.key === 'ArrowDown') navigate(); }} />
```

## Detected Patterns

| Pattern | Example |
|---|---|
| `addEventListener('keydown' \| 'keyup', handler)` with a non-Enter key check | `el.addEventListener('keydown', e => { if (e.key === 'Escape') ... })` |
| `onkeydown` / `onkeyup` property assignment with a non-Enter key check | `el.onkeydown = e => { if (e.key === 'Tab') ... }` |
| JSX `onKeyDown` / `onKeyUp` prop on IME-capable elements with a non-Enter key check | `<input onKeyDown={e => { if (e.key === 'Escape') ... }} />` |
| JSX `onkeydown` / `onkeyup` prop on IME-capable elements with a non-Enter key check | `<input onkeydown={e => { if (e.key === 'Tab') ... }} />` |
| `e.key` / `e.code` comparison to a non-Enter value | `if (e.key === 'Escape') ...` / `if (e.key !== 'Tab') return` |
| Legacy `e.keyCode` / `e.which` comparison to a non-Enter value | `if (e.keyCode === 27) ...` / `if (e.which !== 9) return` |
| `switch` on `e.key` / `e.code` / `e.keyCode` / `e.which` with any non-Enter case or `default` branch | `switch (e.key) { case 'Enter': ...; case 'Escape': ... }` |

### IME-capable elements (JSX only)

The JSX patterns (`onKeyDown`, `onKeyUp`, `onkeydown`, `onkeyup`) are only checked on elements where IME input is possible. Key checks on other elements (such as `<div>` or `<button>`) are not flagged.

| Element | Flagged by default |
|---|---|
| `<input>`, `<textarea>` | Yes |
| Any element with `contentEditable` / `contenteditable` (not `"false"`, `{false}`, or `{'false'}`) | Yes |
| PascalCase components (e.g. `<MyInput>`, `<UI.Input>`) | Yes (rendered output unknown) — configurable via [`jsxComponents`](#jsxcomponents) |
| Custom elements (e.g. `<sl-input>`, `<my-text-field>`) | No — configurable via [`customElements`](#customelements) |
| `<select>` | No |
| Other elements (`<div>`, `<button>`, `<span>`, ...) | No |

### Not flagged

| Pattern | Reason |
|---|---|
| Enter key checks | Handled by [`require-ime-safe-submit`](./require-ime-safe-submit.md) |
| Enter-only `switch` with no `default` branch | Handled by [`require-ime-safe-submit`](./require-ime-safe-submit.md) |
| `e.isComposing` guard in `keydown`/`keyup` | Sufficient for this rule because Safari's Enter-specific `keyCode === 229` issue is out of scope |
| `e.isComposing \|\| e.keyCode === 229` guard in `keydown`/`keyup` | Also accepted |
| `!e.isComposing && e.keyCode !== 229` in blocking position | De Morgan equivalent of the guard; the guarded non-Enter check must be inside the condition or its consequent body |
| `e.nativeEvent.isComposing` (React synthetic event) | Equivalent IME guard |
| `if (guardFn(e)) return;` (with `guardFunctions` option) | Guard function declared as an IME-safe guard |
| Non-Enter key check combined with a modifier via `&&` (`e.ctrlKey`, `e.metaKey`, `e.shiftKey`, `e.altKey`) | IME cannot be composing while a modifier key is held |
| Outer `if` whose test is a positive modifier expression, non-Enter key check inside the body | Same reasoning |
| Key check inside a nested function | Out of scope for the original keydown handler |
| Named function reference (`addEventListener('keydown', fn)`) | Cannot statically analyze external function bodies |
| JSX key check on non-IME-capable element (`<div>`, `<button>`, etc.) | Element cannot receive IME input |

### Known limitations

- **Ternary `isComposing` guard is not recognized.** Only `IfStatement` tests are checked. `e.isComposing ? null : (e.key === 'Escape' && closeDialog())` will be flagged even though it is IME-safe. Use an `if` statement instead.
- **`!==` / `!=` patterns in a block body are detected but not in isolation.** If the entire handler never reaches the target code after the key check, the flag may be a false positive. Use `// eslint-disable-next-line` for those rare cases.
- **`isComposing` without early exit is not a guard.** `if (e.isComposing) console.log('composing')` does not qualify; subsequent key checks are still flagged.
- **Destructured event parameters are not detected.** Write `(e) => { if (e.key === 'Escape') ... }` rather than `({ key }) => { if (key === 'Escape') ... }`.
- **`addEventListener` and `onkeydown =` do not scope by element type.** Even if the handler is attached to a non-input element, the non-JSX patterns are still checked.

## Options

### `guardFunctions` (default: `[]`)

If your codebase extracts the `isComposing` check into a shared helper, list those function names here. The rule will treat a call matching `if (guardFn(e)) return;` — appearing before the guarded key check at the top level of the handler body, or as the first statement inside a key-check if-body — as an equivalent IME guard.

```js
import imeSafeForm from 'eslint-plugin-ime-safe-form';

export default [
  {
    plugins: { 'ime-safe-form': imeSafeForm },
    rules: {
      'ime-safe-form/require-ime-safe-key-events': ['warn', {
        guardFunctions: ['guardIsComposing'],
      }],
    },
  },
];
```

```js
const guardIsComposing = (e) => e.isComposing || e.keyCode === 229;

input.addEventListener('keydown', (e) => {
  if (guardIsComposing(e)) return;
  if (e.key === 'Escape') closeDialog();
});
```

### `jsxComponents`

Controls how PascalCase components and dot-notation components (for example `<MyInput>` and `<UI.Input>`) are treated in JSX.

| Property | Type | Default | Description |
|---|---|---|---|
| `default` | `'check' \| 'ignore'` | `'check'` | Default behavior for components not in either list |
| `allowComponents` | `string[]` | `[]` | Components to never flag |
| `disallowComponents` | `string[]` | `[]` | Components to always flag |

```jsx
// Exempted — no warning even without an isComposing guard
<ComboBox onKeyDown={(e) => { if (e.key === 'ArrowDown') navigate(); }} />
<UI.Input onKeyDown={(e) => { if (e.key === 'Escape') closeDialog(); }} />
```

### `customElements`

Controls how custom elements (lowercase hyphenated names such as `<sl-input>` and `<my-text-field>`) are treated in JSX. Custom elements are not flagged by default because the rule cannot determine their rendered output.

| Property | Type | Default | Description |
|---|---|---|---|
| `default` | `'check' \| 'ignore'` | `'ignore'` | Default behavior for elements not in either list |
| `allowElements` | `string[]` | `[]` | Elements to never flag |
| `disallowElements` | `string[]` | `[]` | Elements to always flag |

```jsx
// Not flagged by default — custom elements are ignored unless configured
<sl-input onKeyDown={(e) => { if (e.key === 'Escape') closeDialog(); }} />

// Flagged when disallowElements includes 'sl-input'
<sl-input onKeyDown={(e) => { if (e.key === 'Escape') closeDialog(); }} />
```

### `allowComponents` (default: `[]`) — deprecated

Use [`jsxComponents.allowComponents`](#jsxcomponents) instead. Both options are merged when used together.

### `checkKeyCodeForSafari` (default: `true`)

This option is accepted for shared-config compatibility, but it has no effect on `require-ime-safe-key-events`.

Safari's `keyCode === 229` workaround is only relevant to Enter confirming IME candidates, and Enter handling belongs to [`require-ime-safe-submit`](./require-ime-safe-submit.md). For non-Enter keys, `e.isComposing` alone is enough for this rule.

## When Not to Use

If your application intentionally intercepts non-Enter keys during IME composition, you can disable this rule inline:

```js
// eslint-disable-next-line ime-safe-form/require-ime-safe-key-events
input.addEventListener('keydown', handler);
```

## Further Reading

- [MDN — compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [MDN — KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
- [MDN — keypress event (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event)
