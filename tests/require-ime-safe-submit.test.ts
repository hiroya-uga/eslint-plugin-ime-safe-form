import { RuleTester } from 'eslint';
import rule = require('../src/rules/require-ime-safe-submit');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('require-ime-safe-submit', rule, {
  valid: [
    // ── addEventListener: isComposing + Safari guard ────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
    // isComposing guard only (checkKeyCodeForSafari: false)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // Non-Enter key checks are NOT flagged (Enter-specific rule)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') next(); });`,
    },
    // form submit event is fine
    {
      code: `form.addEventListener('submit', () => { submit(); });`,
    },
    // ── onkeydown assignment ────────────────────────────────────────────────
    {
      code: `input.onkeydown = (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); };`,
    },
    // Non-Enter via onkeydown — not flagged
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Escape') close(); };`,
    },
    // ── JSX ────────────────────────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
    },
    // Non-Enter JSX — not flagged
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
    },
    // ── guardFunctions option ───────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (guardComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ['guardComposing'], checkKeyCodeForSafari: false }],
    },
  ],
  invalid: [
    // ── addEventListener ────────────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    // Missing Safari keyCode guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: true }],
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // ── onkeydown assignment ────────────────────────────────────────────────
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // ── JSX ────────────────────────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
  ],
});

console.log('All tests passed!');
