import type { Rule } from 'eslint';
import type { BaseNode, Node } from 'estree';
import { FUNCTION_TYPES, isImeCapableJsxElement } from './helpers';
import type { CustomElementsOption, JSXAttribute, JsxComponentsOption } from './helpers';

const DOM_INPUT_EVENTS = new Set(['input', 'beforeinput']);
const JSX_DOM_INPUT_EVENTS = new Set([
  'onInput', 'onBeforeInput', 'onChange',
  'oninput', 'onbeforeinput', 'onchange',
]);

type EventParam =
  | { kind: 'identifier'; name: string }
  | { kind: 'destructured'; targetValueNames: Set<string>; isComposingNames: Set<string> };

const extractEventParam = (rawParam: unknown): EventParam | undefined => {
  if (rawParam === null || rawParam === undefined) {
    return undefined;
  }
  const firstParam = rawParam as Node;
  const binding: Node =
    firstParam.type === 'AssignmentPattern'
      ? (firstParam as { type: 'AssignmentPattern'; left: Node }).left
      : firstParam;

  if (binding.type === 'Identifier') {
    return { kind: 'identifier', name: binding.name };
  }

  if (binding.type !== 'ObjectPattern') {
    return undefined;
  }

  const targetValueNames = new Set<string>();
  const isComposingNames = new Set<string>();

  for (const prop of binding.properties) {
    if (prop.type === 'RestElement') {
      continue;
    }
    if (prop.computed === true) {
      continue;
    }
    if (prop.key.type !== 'Identifier') {
      continue;
    }
    const keyName = prop.key.name;
    const propValue = prop.value as Node;

    let localName: string | undefined;
    if (propValue.type === 'Identifier') {
      localName = propValue.name;
    } else if (propValue.type === 'AssignmentPattern') {
      const assignLeft = (propValue as { type: 'AssignmentPattern'; left: Node }).left;
      if (assignLeft.type === 'Identifier') {
        localName = assignLeft.name;
      }
    }

    if (localName === undefined) {
      continue;
    }
    if (keyName === 'target' || keyName === 'currentTarget') {
      targetValueNames.add(localName);
    } else if (keyName === 'isComposing') {
      isComposingNames.add(localName);
    }
  }

  if (targetValueNames.size === 0 && isComposingNames.size === 0) {
    return undefined;
  }
  return { kind: 'destructured', targetValueNames, isComposingNames };
};

const isIsComposingNode = ({ node, param }: { node: Node; param: EventParam }): boolean => {
  if (param.kind === 'destructured') {
    return node.type === 'Identifier' && param.isComposingNames.has(node.name);
  }
  if (node.type !== 'MemberExpression' || node.computed === true) {
    return false;
  }
  if (node.property.type !== 'Identifier' || node.property.name !== 'isComposing') {
    return false;
  }
  const root = node.object;
  if (root.type === 'Identifier' && root.name === param.name) {
    return true;
  }
  if (
    root.type === 'MemberExpression' &&
    root.computed === false &&
    root.property.type === 'Identifier' &&
    root.property.name === 'nativeEvent'
  ) {
    const rootRoot = root.object;
    return rootRoot.type === 'Identifier' && rootRoot.name === param.name;
  }
  return false;
};

const composingGuaranteesExit = ({ node, param }: { node: Node; param: EventParam }): boolean => {
  if (isIsComposingNode({ node, param })) {
    return true;
  }
  if (node.type === 'LogicalExpression' && node.operator === '||') {
    return (
      composingGuaranteesExit({ node: node.left as Node, param }) ||
      composingGuaranteesExit({ node: node.right as Node, param })
    );
  }
  return false;
};

const composingBlocksEntry = ({ node, param }: { node: Node; param: EventParam }): boolean => {
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return isIsComposingNode({ node: node.argument as Node, param });
  }
  if (node.type === 'LogicalExpression' && node.operator === '&&') {
    return (
      composingBlocksEntry({ node: node.left as Node, param }) ||
      composingBlocksEntry({ node: node.right as Node, param })
    );
  }
  return false;
};

const hasEarlyExit = (ifNode: Node): boolean => {
  if (ifNode.type !== 'IfStatement') {
    return false;
  }
  const { consequent } = ifNode;
  if (consequent.type === 'ReturnStatement' || consequent.type === 'ThrowStatement') {
    return true;
  }
  if (consequent.type === 'BlockStatement') {
    return consequent.body.some((stmt) => stmt.type === 'ReturnStatement' || stmt.type === 'ThrowStatement');
  }
  return false;
};

const isEventTargetValueLhs = ({ node, param }: { node: Node; param: EventParam }): boolean => {
  if (node.type !== 'MemberExpression' || node.computed === true) {
    return false;
  }
  if (node.property.type !== 'Identifier' || node.property.name !== 'value') {
    return false;
  }
  const innerObj = node.object;
  if (param.kind === 'destructured') {
    return innerObj.type === 'Identifier' && param.targetValueNames.has(innerObj.name);
  }
  if (innerObj.type !== 'MemberExpression' || innerObj.computed === true) {
    return false;
  }
  if (innerObj.property.type !== 'Identifier') {
    return false;
  }
  const propName = innerObj.property.name;
  if (propName !== 'target' && propName !== 'currentTarget') {
    return false;
  }
  const rootNode = innerObj.object;
  return rootNode.type === 'Identifier' && rootNode.name === param.name;
};

const isTargetValueWrite = ({ node, param }: { node: Node; param: EventParam }): boolean => {
  if (node.type !== 'AssignmentExpression') {
    return false;
  }
  return isEventTargetValueLhs({ node: node.left as Node, param });
};

const containsValueWriteOutsideGuard = ({
  node,
  param,
  visited,
}: {
  node: Node | null | undefined;
  param: EventParam;
  visited: Set<object>;
}): boolean => {
  if (node === null || node === undefined || typeof node !== 'object' || visited.has(node)) {
    return false;
  }
  visited.add(node);

  if (FUNCTION_TYPES.has(node.type)) {
    return false;
  }

  if (node.type === 'BlockStatement') {
    for (const stmt of node.body) {
      if (
        stmt.type === 'IfStatement' &&
        composingGuaranteesExit({ node: stmt.test as Node, param }) &&
        hasEarlyExit(stmt)
      ) {
        return false;
      }
      if (containsValueWriteOutsideGuard({ node: stmt, param, visited })) {
        return true;
      }
    }
    return false;
  }

  if (node.type === 'IfStatement') {
    const testNode = node.test as Node;
    if (composingBlocksEntry({ node: testNode, param })) {
      // !isComposing in test: consequent entered only when not composing → safe
      return containsValueWriteOutsideGuard({ node: node.alternate, param, visited });
    }
    if (composingGuaranteesExit({ node: testNode, param })) {
      // isComposing in test: alternate entered only when not composing → safe
      return containsValueWriteOutsideGuard({ node: node.consequent, param, visited });
    }
    return (
      containsValueWriteOutsideGuard({ node: node.consequent, param, visited }) ||
      containsValueWriteOutsideGuard({ node: node.alternate, param, visited })
    );
  }

  if (isTargetValueWrite({ node, param })) {
    return true;
  }

  for (const [key, value] of Object.entries(node as object)) {
    if (key === 'parent') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child !== null && typeof child === 'object' && 'type' in child) {
          if (containsValueWriteOutsideGuard({ node: child as Node, param, visited })) {
            return true;
          }
        }
      }
    } else if (value !== null && typeof value === 'object' && 'type' in value) {
      if (containsValueWriteOutsideGuard({ node: value as Node, param, visited })) {
        return true;
      }
    }
  }

  return false;
};

const DEFAULT_JSX_COMPONENTS: JsxComponentsOption = {
  default: 'check',
  allowComponents: [],
  disallowComponents: [],
};

const DEFAULT_CUSTOM_ELEMENTS: CustomElementsOption = {
  default: 'ignore',
  allowElements: [],
  disallowElements: [],
};

const checkHandler = ({
  handlerNode,
  reportNode,
  eventName,
  context,
}: {
  handlerNode: Node | null | undefined;
  reportNode: BaseNode;
  eventName: string;
  context: Rule.RuleContext;
}): void => {
  if (handlerNode === null || handlerNode === undefined) {
    return;
  }
  if (handlerNode.type !== 'ArrowFunctionExpression' && handlerNode.type !== 'FunctionExpression') {
    return;
  }
  const param = extractEventParam(handlerNode.params[0]);
  if (param === undefined) {
    return;
  }
  if (containsValueWriteOutsideGuard({ node: handlerNode.body, param, visited: new Set() })) {
    context.report({ node: reportNode, messageId: 'requireImeSafeInput', data: { eventName } });
  }
};

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Require IME-safe handling when rewriting input field values in 'input' or 'beforeinput' event handlers, or JSX 'onChange'.",
      recommended: false,
      url: 'https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-input.md',
    },
    messages: {
      requireImeSafeInput:
        "Rewriting 'event.target.value' in a '{{eventName}}' handler can disrupt IME composition. Add 'if (event.isComposing) return;' or move the formatting to 'blur' or 'compositionend'.",
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
          args.length >= 2;

        if (isAddEventListenerCall === false) {
          return;
        }

        const eventArg = args[0];
        if (eventArg === undefined) {
          return;
        }
        if (
          eventArg.type !== 'Literal' ||
          typeof eventArg.value !== 'string' ||
          DOM_INPUT_EVENTS.has(eventArg.value) === false
        ) {
          return;
        }

        checkHandler({ handlerNode: args[1], reportNode: node, eventName: eventArg.value, context });
      },

      AssignmentExpression(node) {
        const { left, right } = node;

        if (left.type !== 'MemberExpression' || left.computed === true || left.property.type !== 'Identifier') {
          return;
        }

        const propName = left.property.name;
        if (propName.startsWith('on') === false) {
          return;
        }
        const eventName = propName.slice(2);
        if (DOM_INPUT_EVENTS.has(eventName) === false) {
          return;
        }

        checkHandler({ handlerNode: right, reportNode: left, eventName, context });
      },

      JSXAttribute(rawNode: unknown) {
        const node = rawNode as JSXAttribute;

        if (node.name.type !== 'JSXIdentifier' || JSX_DOM_INPUT_EVENTS.has(node.name.name) === false) {
          return;
        }

        if (
          isImeCapableJsxElement({
            openingElement: node.parent,
            jsxComponents: DEFAULT_JSX_COMPONENTS,
            customElements: DEFAULT_CUSTOM_ELEMENTS,
          }) === false
        ) {
          return;
        }

        const value = node.value;
        if (value?.type !== 'JSXExpressionContainer') {
          return;
        }

        checkHandler({
          handlerNode: value.expression as Node | null | undefined,
          reportNode: node.name,
          eventName: node.name.name,
          context,
        });
      },
    };
  },
};

export = rule;
