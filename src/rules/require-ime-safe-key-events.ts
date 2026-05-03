import type { Rule } from 'eslint';
import {
  containsNonEnterKeyCheck,
  containsNonEnterKeyCheckOutsideIsComposingGuard,
  containsNonEnterKeyCheckOutsideModifierGuard,
} from './helpers';
import { makeRuleCreate, RULE_SCHEMA } from './key-event-rule';

const messages = {
  requireImeSafeSubmit:
    "Key check detected in '{{eventName}}' without an IME composition guard. Add 'if (e.isComposing) return;' before the check.",
  requireKeyCode229:
    "In Safari, compositionend fires before keydown, so e.isComposing is false when Enter confirms IME. Add '|| e.keyCode === 229' to the guard: 'if (e.isComposing || e.keyCode === 229) return;'.",
} as const;

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow IME-unsafe key event handlers for non-Enter keys. Require an e.isComposing guard in keydown/keyup handlers with key checks. Use require-ime-safe-submit for Enter-key-specific checks.',
      recommended: true,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-key-events.md',
    },
    messages,
    schema: RULE_SCHEMA,
  },

  create: makeRuleCreate({
    checkHelpers: {
      outsideIsComposingGuard: containsNonEnterKeyCheckOutsideIsComposingGuard,
      outsideModifierGuard: containsNonEnterKeyCheckOutsideModifierGuard,
      hasKeyCheck: containsNonEnterKeyCheck,
    },
    checkSafariEnter: false,
  }),
};

export = rule;
