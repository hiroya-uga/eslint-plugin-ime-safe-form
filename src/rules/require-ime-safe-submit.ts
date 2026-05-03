import type { Rule } from 'eslint';
import requireImeSafeKeyEvents = require('./require-ime-safe-key-events');

const rule: Rule.RuleModule = {
  ...requireImeSafeKeyEvents,
  meta: {
    ...requireImeSafeKeyEvents.meta,
    deprecated: {
      replacedBy: [{ rule: { name: 'require-ime-safe-key-events' } }],
    },
    docs: {
      ...requireImeSafeKeyEvents.meta?.docs,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-submit.md',
    },
  },
};

export = rule;
