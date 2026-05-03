import type { Rule } from 'eslint';
import type { BaseNode, Node } from 'estree';
import {
  containsEnterKeyCheckOutsideModifierGuard,
  containsKeyCheckOutsideIsComposingGuard,
  containsKeyCheckOutsideModifierGuard,
  containsKeyCheck,
  DEPRECATED_JSX_KEY_EVENTS,
  DEPRECATED_KEY_EVENTS,
  hasKeyCode229Check,
  isImeCapableJsxElement,
  JSX_KEY_EVENTS,
  KEY_EVENTS,
} from './helpers';
import type { CustomElementsOption, JSXAttribute, JsxComponentsOption } from './helpers';

const messages = {
  requireImeSafeSubmit:
    "Key check detected in '{{eventName}}' without an IME composition guard. Add 'if (e.isComposing) return;' before the check.",
  keypressProhibited:
    "'keypress' is deprecated. Use 'keydown' with an 'if (e.isComposing) return;' guard instead.",
  requireKeyCode229:
    "In Safari, compositionend fires before keydown, so e.isComposing is false when Enter confirms IME. Add '|| e.keyCode === 229' to the guard: 'if (e.isComposing || e.keyCode === 229) return;'.",
} as const;

type JsxComponentsConfig = {
  default?: 'check' | 'ignore';
  allowComponents?: string[];
  disallowComponents?: string[];
};

type CustomElementsConfig = {
  default?: 'check' | 'ignore';
  allowElements?: string[];
  disallowElements?: string[];
};

type RuleOptions = {
  checkKeyCodeForSafari?: boolean;
  guardFunctions?: string[];
  allowComponents?: string[];
  jsxComponents?: JsxComponentsConfig;
  customElements?: CustomElementsConfig;
};

// ESLint validates schema before create() is called, so a shape check suffices.
const isRuleOptions = (value: unknown): value is RuleOptions =>
  value !== null && typeof value === 'object';

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
            description: 'Deprecated. Use jsxComponents.allowComponents instead.',
          },
          jsxComponents: {
            type: 'object',
            properties: {
              default: { type: 'string', enum: ['check', 'ignore'] },
              allowComponents: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true,
              },
              disallowComponents: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true,
              },
            },
            additionalProperties: false,
          },
          customElements: {
            type: 'object',
            properties: {
              default: { type: 'string', enum: ['check', 'ignore'] },
              allowElements: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true,
              },
              disallowElements: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true,
              },
            },
            additionalProperties: false,
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

    const jsxComponentsOption: JsxComponentsOption = {
      default: options.jsxComponents?.default ?? 'check',
      // Merge deprecated top-level allowComponents with jsxComponents.allowComponents
      allowComponents: [
        ...(options.allowComponents ?? []),
        ...(options.jsxComponents?.allowComponents ?? []),
      ],
      disallowComponents: options.jsxComponents?.disallowComponents ?? [],
    };

    const customElementsOption: CustomElementsOption = {
      default: options.customElements?.default ?? 'ignore',
      allowElements: options.customElements?.allowElements ?? [],
      disallowElements: options.customElements?.disallowElements ?? [],
    };

    const checkHandlerBody = ({
      body,
      reportNode,
      eventName,
      eventParamName,
      allowIsComposingGuard,
    }: {
      body: Node;
      reportNode: BaseNode;
      eventName: string;
      eventParamName: string | undefined;
      allowIsComposingGuard: boolean;
    }) => {
      if (allowIsComposingGuard && containsKeyCheckOutsideIsComposingGuard({ node: body, eventParamName }) === false) {
        const needsSafariKeyCodeGuard =
          checkKeyCodeForSafari &&
          hasKeyCode229Check({ node: body, eventParamName }) === false &&
          containsEnterKeyCheckOutsideModifierGuard({ node: body, eventParamName });
        if (needsSafariKeyCodeGuard) {
          context.report({ node: reportNode, messageId: 'requireKeyCode229' });
        }
        return;
      }
      if (allowIsComposingGuard && guardFunctions.length > 0 && containsKeyCheckOutsideIsComposingGuard({ node: body, eventParamName, guardFunctions }) === false) {
        return;
      }
      if (allowIsComposingGuard && containsKeyCheckOutsideModifierGuard({ node: body, eventParamName }) === false) {
        return;
      }
      if (containsKeyCheck({ node: body, eventParamName })) {
        context.report({
          node: reportNode,
          messageId: allowIsComposingGuard ? 'requireImeSafeSubmit' : 'keypressProhibited',
          data: { eventName },
        });
      }
    };

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
      const firstParam = handlerNode.params[0];
      const paramBinding = firstParam?.type === 'AssignmentPattern' ? firstParam.left : firstParam;
      const eventParamName = paramBinding?.type === 'Identifier' ? paramBinding.name : undefined;
      checkHandlerBody({ body: handlerNode.body, reportNode, eventName, eventParamName, allowIsComposingGuard });
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

      // Pattern 3: JSX onKeyDown / onKeyUp / onKeyPress / onkeydown / onkeyup / onkeypress
      JSXAttribute(rawNode: unknown) {
        const node = rawNode as JSXAttribute;

        const isJsxKeyEventProp = node.name.type === 'JSXIdentifier' && JSX_KEY_EVENTS.has(node.name.name);

        if (isJsxKeyEventProp === false) {
          return;
        }

        if (!isImeCapableJsxElement({ openingElement: node.parent, jsxComponents: jsxComponentsOption, customElements: customElementsOption })) {
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
