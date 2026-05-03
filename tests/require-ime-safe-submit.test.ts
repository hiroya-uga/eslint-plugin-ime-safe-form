import { RuleTester } from 'eslint';
import rule = require('../src/rules/require-ime-safe-submit');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('require-ime-safe-submit', rule, {
  valid: [
    // isComposing guard exempts Enter check (Safari check disabled)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // isComposing + Safari keyCode guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
    // Non-Enter key check without isComposing is NOT flagged (Enter-specific rule)
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
  ],
  invalid: [
    // Enter check without isComposing guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    // keypress with Enter check
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // Missing Safari keyCode guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: true }],
      errors: [{ messageId: 'requireKeyCode229' }],
    },
  ],
});

console.log('All tests passed!');
