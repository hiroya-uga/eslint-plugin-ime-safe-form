import { RuleTester } from 'eslint';
import rule from '../src/rules/no-keypress-event';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('no-keypress-event', rule, {
  valid: [
    // keydown / keyup — not flagged
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Tab') focusNext(); });`,
    },
    // onkeydown / onkeyup assignment — not flagged
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };`,
    },
    {
      code: `input.onkeyup = (e) => { if (e.key === 'Tab') focusNext(); };`,
    },
    // JSX onKeyDown / onKeyUp — not flagged
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `<input onKeyUp={(e) => { if (e.key === 'Tab') focusNext(); }} />;`,
    },
    // camelCase onKeyPress DOM assignment — not a valid DOM API, not flagged
    {
      code: `input.onKeyPress = (e) => { if (e.key === 'Enter') submit(); };`,
    },
    // unrelated event — not flagged
    {
      code: `btn.addEventListener('click', () => submit());`,
    },
    {
      code: `form.addEventListener('submit', (e) => { e.preventDefault(); send(); });`,
    },
    // click event — not flagged
    {
      code: `input.addEventListener('click', handler);`,
    },
  ],

  invalid: [
    // ── addEventListener('keypress', ...) ─────────────────────────────────────
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // Named function reference — still flagged (event name itself is deprecated)
    {
      code: `input.addEventListener('keypress', handleKeypress);`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // window target
    {
      code: `window.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // ── onkeypress assignment ─────────────────────────────────────────────────
    {
      code: `input.onkeypress = (e) => { if (e.key === 'Escape') close(); };`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    {
      code: `input.onkeypress = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // Named function reference via assignment
    {
      code: `input.onkeypress = handleKeypress;`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // ── JSX onKeyPress ────────────────────────────────────────────────────────
    {
      code: `<input onKeyPress={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    {
      code: `<input onKeyPress={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // Non-input element — flagged regardless (keypress deprecated for all elements)
    {
      code: `<div onKeyPress={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
    // ── JSX onkeypress (lowercase) ────────────────────────────────────────────
    {
      code: `<input onkeypress={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'keypressDeprecated' }],
    },
  ],
});

console.log('All tests passed!');
