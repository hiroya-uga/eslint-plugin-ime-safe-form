import type { Rule } from 'eslint';
import type { JSXAttribute } from './helpers';

const KEYPRESS_JSX_EVENTS = new Set(['onKeyPress', 'onkeypress']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow 'keypress' event handlers. Use 'keydown' instead.",
      recommended: true,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/no-keypress-event.md',
    },
    messages: {
      keypressDeprecated: "'keypress' is deprecated. Use 'keydown' instead.",
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        const isAddEventListenerCall =
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'addEventListener' &&
          args.length >= 1;

        if (isAddEventListenerCall === false) {
          return;
        }

        const eventArg = args[0];

        if (eventArg === undefined) {
          return;
        }
        if (eventArg.type !== 'Literal' || eventArg.value !== 'keypress') {
          return;
        }

        context.report({ node, messageId: 'keypressDeprecated' });
      },

      AssignmentExpression(node) {
        const { left } = node;

        if (left.type !== 'MemberExpression' || left.computed || left.property.type !== 'Identifier') {
          return;
        }
        if (left.property.name !== 'onkeypress') {
          return;
        }

        context.report({ node: left, messageId: 'keypressDeprecated' });
      },

      JSXAttribute(rawNode: unknown) {
        const node = rawNode as JSXAttribute;

        if (node.name.type !== 'JSXIdentifier' || !KEYPRESS_JSX_EVENTS.has(node.name.name)) {
          return;
        }

        context.report({ node: node.name, messageId: 'keypressDeprecated' });
      },
    };
  },
};

export = rule;
