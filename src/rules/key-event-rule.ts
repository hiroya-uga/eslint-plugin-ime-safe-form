import type { Rule } from 'eslint';
import type { BaseNode, Node } from 'estree';
import {
  containsEnterKeyCheckOutsideModifierGuard,
  hasKeyCode229Check,
  isImeCapableJsxElement,
  JSX_KEY_EVENTS,
  KEY_EVENTS,
} from './helpers';
import type { CustomElementsOption, JSXAttribute, JsxComponentsOption } from './helpers';

export type JsxComponentsConfig = {
  default?: 'check' | 'ignore';
  allowComponents?: string[];
  disallowComponents?: string[];
};

export type CustomElementsConfig = {
  default?: 'check' | 'ignore';
  allowElements?: string[];
  disallowElements?: string[];
};

export type RuleOptions = {
  checkKeyCodeForSafari?: boolean;
  guardFunctions?: string[];
  allowComponents?: string[];
  jsxComponents?: JsxComponentsConfig;
  customElements?: CustomElementsConfig;
};

export const isRuleOptions = (value: unknown): value is RuleOptions =>
  value !== null && typeof value === 'object';

export const RULE_SCHEMA = [
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
];

type KeyCheckArgs = { node: Node | null | undefined; eventParamName: string | undefined };
type KeyCheckWithGuardArgs = KeyCheckArgs & { guardFunctions?: string[] };

export type KeyCheckHelpers = {
  outsideIsComposingGuard: (args: KeyCheckWithGuardArgs) => boolean;
  outsideModifierGuard: (args: KeyCheckArgs) => boolean;
  hasKeyCheck: (args: KeyCheckArgs) => boolean;
};

export const makeRuleCreate = ({ checkHelpers, checkSafariEnter = true }: { checkHelpers: KeyCheckHelpers; checkSafariEnter?: boolean }): Rule.RuleModule['create'] =>
  (context) => {
    const { outsideIsComposingGuard, outsideModifierGuard, hasKeyCheck } = checkHelpers;

    const rawOption = context.options[0];
    const options: RuleOptions = isRuleOptions(rawOption) ? rawOption : {};
    const checkKeyCodeForSafari = options.checkKeyCodeForSafari !== false;
    const guardFunctions = options.guardFunctions ?? [];

    const jsxComponentsOption: JsxComponentsOption = {
      default: options.jsxComponents?.default ?? 'check',
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
    }: {
      body: Node;
      reportNode: BaseNode;
      eventName: string;
      eventParamName: string | undefined;
    }) => {
      if (outsideIsComposingGuard({ node: body, eventParamName }) === false) {
        const needsSafariKeyCodeGuard =
          checkSafariEnter &&
          checkKeyCodeForSafari &&
          hasKeyCode229Check({ node: body, eventParamName }) === false &&
          containsEnterKeyCheckOutsideModifierGuard({ node: body, eventParamName });
        if (needsSafariKeyCodeGuard) {
          context.report({ node: reportNode, messageId: 'requireKeyCode229' });
        }
        return;
      }
      if (guardFunctions.length > 0 && outsideIsComposingGuard({ node: body, eventParamName, guardFunctions }) === false) {
        return;
      }
      if (outsideModifierGuard({ node: body, eventParamName }) === false) {
        return;
      }
      if (hasKeyCheck({ node: body, eventParamName })) {
        context.report({
          node: reportNode,
          messageId: 'requireImeSafeSubmit',
          data: { eventName },
        });
      }
    };

    const checkHandler = ({
      handlerNode,
      reportNode,
      eventName,
    }: {
      handlerNode: Node | null | undefined;
      reportNode: BaseNode;
      eventName: string;
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
      checkHandlerBody({ body: handlerNode.body, reportNode, eventName, eventParamName });
    };

    return {
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
        });
      },

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
        });
      },

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
        });
      },
    };
  };
