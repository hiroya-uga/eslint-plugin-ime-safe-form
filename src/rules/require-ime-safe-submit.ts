import type { Rule } from 'eslint';
import type { BaseNode, Node } from 'estree';
import {
  containsEnterKeyCheck,
  containsKeyCheck,
  DEPRECATED_JSX_KEY_EVENTS,
  DEPRECATED_KEY_EVENTS,
  hasGuardFunctionCall,
  hasIsComposingCheck,
  hasKeyCode229Check,
  hasModifierKeyGuard,
  isImeCapableJsxElement,
  JSX_KEY_EVENTS,
  KEY_EVENTS,
} from './helpers';
import type { JSXAttribute } from './helpers';

const messages = {
  requireImeSafeSubmit:
    "Key check detected in '{{eventName}}' without an IME composition guard. Add 'if (e.isComposing) return;' before the check, or handle submission via the form's 'submit' event.",
  keypressProhibited:
    "'keypress' is deprecated. Use 'keydown' with an e.isComposing guard instead, or handle submission via the form's 'submit' event.",
  requireKeyCode229:
    "In Safari, compositionend fires before keydown, so e.isComposing is false when Enter confirms IME. Add '|| e.keyCode === 229' to the guard: 'if (e.isComposing || e.keyCode === 229) return;'.",
} as const;

type RuleOptions = {
  checkKeyCodeForSafari?: boolean;
  guardFunctions?: string[];
  allowComponents?: string[];
};

// ESLint validates schema before create() is called, so a shape check suffices.
const isRuleOptions = (value: unknown): value is RuleOptions =>
  value !== null && value !== undefined && typeof value === 'object';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require IME-safe form submission. Disallow Enter key detection in keydown/keyup without an e.isComposing guard, and prohibit keypress entirely.',
      recommended: true,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-submit.md',
    },
    messages,
    schema: [
      {
        type: 'object',
        properties: {
          checkKeyCodeForSafari: { type: 'boolean' },
          guardFunctions: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
          allowComponents: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const rawOption = context.options[0];
    const options: RuleOptions = isRuleOptions(rawOption) ? rawOption : {};
    // Default true: only opt out when explicitly { checkKeyCodeForSafari: false }
    const checkKeyCodeForSafari = options.checkKeyCodeForSafari !== false;
    const guardFunctions = options.guardFunctions ?? [];
    const allowComponents = options.allowComponents ?? [];

    /**
     * @param allowIsComposingGuard
     *   true  — keydown/keyup: an e.isComposing guard exempts the handler.
     *   false — keypress: always flag regardless of isComposing.
     */
    const checkHandler = ({
      handlerNode,
      reportNode,
      eventName,
      allowIsComposingGuard,
    }: {
      handlerNode: Node | null | undefined;
      reportNode: BaseNode;
      eventName: string;
      allowIsComposingGuard: boolean;
    }) => {
      if (handlerNode === null || handlerNode === undefined) {
        return;
      }
      if (handlerNode.type !== 'ArrowFunctionExpression' && handlerNode.type !== 'FunctionExpression') {
        return;
      }

      const body = handlerNode.body;

      if (allowIsComposingGuard && hasIsComposingCheck(body)) {
        const needsSafariKeyCodeGuard =
          checkKeyCodeForSafari &&
          hasKeyCode229Check(body) === false &&
          containsEnterKeyCheck(body) &&
          hasModifierKeyGuard(body) === false;

        if (needsSafariKeyCodeGuard) {
          context.report({
            node: reportNode,
            messageId: 'requireKeyCode229',
          });
        }
        return;
      }

      const hasUserDefinedGuard = guardFunctions.length > 0 && hasGuardFunctionCall({ node: body, guardFunctions });

      if (allowIsComposingGuard && hasUserDefinedGuard) {
        return;
      }

      if (allowIsComposingGuard && hasModifierKeyGuard(body)) {
        return;
      }

      if (containsKeyCheck(body)) {
        context.report({
          node: reportNode,
          messageId: allowIsComposingGuard ? 'requireImeSafeSubmit' : 'keypressProhibited',
          data: { eventName },
        });
      }
    };

    return {
      // Pattern 1: element.addEventListener('keydown' | 'keyup' | 'keypress', handler)
      CallExpression(node) {
        const { callee, arguments: args } = node;
        const isAddEventListenerCall =
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'addEventListener' &&
          args.length >= 2;

        if (isAddEventListenerCall === false) {
          return;
        }

        const eventArg = args[0];

        if (eventArg === undefined) {
          return;
        }
        if (eventArg.type !== 'Literal' || typeof eventArg.value !== 'string' || !KEY_EVENTS.has(eventArg.value)) {
          return;
        }

        checkHandler({
          handlerNode: args[1],
          reportNode: node,
          eventName: eventArg.value,
          allowIsComposingGuard: !DEPRECATED_KEY_EVENTS.has(eventArg.value),
        });
      },

      // Pattern 2: element.onkeydown / onkeyup / onkeypress = handler
      AssignmentExpression(node) {
        const { left, right } = node;

        if (left.type !== 'MemberExpression' || left.computed || left.property.type !== 'Identifier') {
          return;
        }

        const propName = left.property.name;
        const isOnKeyEventProp = propName.startsWith('on') && KEY_EVENTS.has(propName.slice(2));

        if (isOnKeyEventProp === false) {
          return;
        }

        checkHandler({
          handlerNode: right,
          reportNode: left,
          eventName: propName,
          allowIsComposingGuard: !DEPRECATED_KEY_EVENTS.has(propName.slice(2)),
        });
      },

      // Pattern 3: JSX onKeyDown / onKeyUp / onKeyPress
      JSXAttribute(rawNode: unknown) {
        const node = rawNode as JSXAttribute;

        const isJsxKeyEventProp = node.name.type === 'JSXIdentifier' && JSX_KEY_EVENTS.has(node.name.name);

        if (isJsxKeyEventProp === false) {
          return;
        }

        if (!isImeCapableJsxElement({ openingElement: node.parent, allowComponents })) {
          return;
        }

        const value = node.value;

        if (value?.type !== 'JSXExpressionContainer') {
          return;
        }

        checkHandler({
          handlerNode: value.expression,
          reportNode: node.name,
          eventName: node.name.name,
          allowIsComposingGuard: !DEPRECATED_JSX_KEY_EVENTS.has(node.name.name),
        });
      },
    };
  },
};

export = rule;
