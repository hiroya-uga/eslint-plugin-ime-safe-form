import type { Rule } from 'eslint';
import {
  containsEnterKeyCheck,
  containsEnterKeyCheckOutsideIsComposingGuard,
  containsEnterKeyCheckOutsideModifierGuard,
} from './helpers';
import { makeRuleCreate, RULE_SCHEMA } from './key-event-rule';

const messages = {
  requireImeSafeSubmit:
    "Enter key check in '{{eventName}}' handler. Use the form's 'submit' event instead, or add 'if (e.isComposing) return;' to guard against IME composition.",
  requireKeyCode229:
    "In Safari, compositionend fires before keydown, so e.isComposing is false when Enter confirms IME. Add '|| e.keyCode === 229' to the guard: 'if (e.isComposing || e.keyCode === 229) return;'.",
} as const;

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow IME-unsafe Enter key handlers. Use the form's submit event instead of handling Enter in keydown/keyup, or add an e.isComposing guard.",
      recommended: true,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-submit.md',
    },
    messages,
    schema: RULE_SCHEMA,
  },

  create: makeRuleCreate({
    checkHelpers: {
      outsideIsComposingGuard: containsEnterKeyCheckOutsideIsComposingGuard,
      outsideModifierGuard: containsEnterKeyCheckOutsideModifierGuard,
      hasKeyCheck: containsEnterKeyCheck,
    },
  }),
};

export = rule;
