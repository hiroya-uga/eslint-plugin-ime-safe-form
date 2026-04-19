import type { Rule } from 'eslint';
import type { BaseNode, Node } from 'estree';
import {
  containsEnterKeyCheck,
  DEPRECATED_JSX_KEY_EVENTS,
  DEPRECATED_KEY_EVENTS,
  hasGuardFunctionCall,
  hasIsComposingCheck,
  hasKeyCode229Check,
  hasModifierKeyGuard,
  JSX_KEY_EVENTS,
  KEY_EVENTS,
} from './helpers';
import type { JSXAttribute } from './helpers';

const messages = {
  requireImeSafeSubmit:
    "Enter key detected in '{{eventName}}' without an IME composition guard. Add 'if (e.isComposing) return;' before the check, or handle submission via the form's 'submit' event.",
  keypressProhibited:
    "'keypress' is deprecated. Use 'keydown' with an e.isComposing guard instead, or handle submission via the form's 'submit' event.",
  requireKeyCode229:
    "In Safari, compositionend fires before keydown, so e.isComposing is false when Enter confirms IME. Add '|| e.keyCode === 229' to the guard: 'if (e.isComposing || e.keyCode === 229) return;'.",
} as const;

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
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const rawOption: unknown = context.options[0];
    // Default true: only opt out when explicitly { checkKeyCodeForSafari: false }
    const checkKeyCodeForSafari = !(
      rawOption !== null &&
      rawOption !== undefined &&
      typeof rawOption === 'object' &&
      'checkKeyCodeForSafari' in rawOption &&
      (rawOption as Record<string, unknown>)['checkKeyCodeForSafari'] === false
    );
    const guardFunctions =
      rawOption !== null &&
      rawOption !== undefined &&
      typeof rawOption === 'object' &&
      'guardFunctions' in rawOption &&
      Array.isArray((rawOption as Record<string, unknown>)['guardFunctions'])
        ? ((rawOption as Record<string, unknown>)['guardFunctions'] as unknown[]).filter(
            (item): item is string => typeof item === 'string',
          )
        : [];

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
        if (checkKeyCodeForSafari && !hasKeyCode229Check(body) && containsEnterKeyCheck(body)) {
          context.report({
            node: reportNode,
            messageId: 'requireKeyCode229',
          });
        }
        return;
      }

      if (
        allowIsComposingGuard &&
        guardFunctions.length > 0 &&
        hasGuardFunctionCall({ node: body, guardFunctions })
      ) {
        return;
      }

      if (allowIsComposingGuard && hasModifierKeyGuard(body)) {
        return;
      }

      if (containsEnterKeyCheck(body)) {
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
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'addEventListener' ||
          args.length < 2
        ) {
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

        const propName = left.property.name.toLowerCase();
        if (propName !== 'onkeydown' && propName !== 'onkeyup' && propName !== 'onkeypress') {
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
        if (node.name.type !== 'JSXIdentifier' || !JSX_KEY_EVENTS.has(node.name.name)) {
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
