import type { Rule } from 'eslint';
import {
  containsKeyCheck,
  containsKeyCheckOutsideIsComposingGuard,
  containsKeyCheckOutsideModifierGuard,
} from './helpers';
import { makeRuleCreate, RULE_SCHEMA } from './key-event-rule';

const messages = {
  requireImeSafeSubmit:
    "Key check detected in '{{eventName}}' without an IME composition guard. Add 'if (e.isComposing) return;' before the check.",
  keypressProhibited:
    "'keypress' is deprecated. Use 'keydown' with an 'if (e.isComposing) return;' guard instead.",
  requireKeyCode229:
    "In Safari, compositionend fires before keydown, so e.isComposing is false when Enter confirms IME. Add '|| e.keyCode === 229' to the guard: 'if (e.isComposing || e.keyCode === 229) return;'.",
} as const;

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow IME-unsafe key event handlers. Require an e.isComposing guard in keydown/keyup handlers with key checks, and prohibit keypress entirely.',
      recommended: false,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-key-events.md',
    },
    messages,
    schema: RULE_SCHEMA,
  },

  create: makeRuleCreate({
    checkHelpers: {
      outsideIsComposingGuard: containsKeyCheckOutsideIsComposingGuard,
      outsideModifierGuard: containsKeyCheckOutsideModifierGuard,
      hasKeyCheck: containsKeyCheck,
    },
  }),
};

export = rule;
