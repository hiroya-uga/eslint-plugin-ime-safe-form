# no-keypress-event

Disallow `keypress` event handlers. Use `keydown` instead.

> [!NOTE]
> To also guard `keydown`/`keyup` handlers against IME composition, use [`require-ime-safe-submit`](./require-ime-safe-submit.md) and [`require-ime-safe-key-events`](./require-ime-safe-key-events.md).

## Rule Details

`keypress` is deprecated. Replace `keypress` handlers with `keydown` and add an `e.isComposing` guard where needed. This rule flags the event name itself, so named function references are also flagged.

### Examples of **incorrect** code

```js
/* eslint ime-safe-form/no-keypress-event: "warn" */

input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
input.addEventListener('keypress', handleKeypress);
input.onkeypress = (e) => { if (e.key === 'Escape') closeDialog(); };
```

```jsx
<input onKeyPress={(e) => { if (e.key === 'Enter') submit(); }} />
<input onkeypress={(e) => { if (e.key === 'Enter') submit(); }} />
```

### Examples of **correct** code

```js
/* eslint ime-safe-form/no-keypress-event: "warn" */

input.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') submit();
});
```

```jsx
<input onKeyDown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />
```

## Options

This rule has no options.

## Further Reading

- [MDN — keypress event (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event)
- [MDN — keydown event](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event)
- [MDN — KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
