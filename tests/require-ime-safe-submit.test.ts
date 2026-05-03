import assert from 'node:assert/strict';
import { RuleTester } from 'eslint';
import rule = require('../src/rules/require-ime-safe-submit');

// Verify deprecated alias metadata
const deprecated = rule.meta?.deprecated;
if (typeof deprecated !== 'object' || deprecated === null) {
  throw new Error('meta.deprecated should be a DeprecatedInfo object');
}
const replacedByList = deprecated.replacedBy ?? [];
assert.ok(replacedByList.some((info) => info.rule?.name === 'require-ime-safe-key-events'));

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// Confirm alias implementation works via representative cases
tester.run('require-ime-safe-submit', rule, {
  valid: [
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
  ],
  invalid: [
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
  ],
});

console.log('All tests passed!');
