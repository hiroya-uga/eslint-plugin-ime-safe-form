import type { BaseNode, Node } from 'estree';

// ESLint does not ship JSX node types, so we define the minimal shape we need.
export interface JSXIdentifier extends BaseNode {
  type: 'JSXIdentifier';
  name: string;
}

export interface JSXExpressionContainer extends BaseNode {
  type: 'JSXExpressionContainer';
  expression: Node | null;
}

export interface JSXSpreadAttribute extends BaseNode {
  type: 'JSXSpreadAttribute';
}

export interface JSXMemberExpression extends BaseNode {
  type: 'JSXMemberExpression';
  object: JSXIdentifier | JSXMemberExpression;
  property: JSXIdentifier;
}

export interface JSXOpeningElement extends BaseNode {
  type: 'JSXOpeningElement';
  name: JSXIdentifier | JSXMemberExpression;
  attributes: Array<JSXAttribute | JSXSpreadAttribute>;
}

export interface JSXAttribute extends BaseNode {
  type: 'JSXAttribute';
  name: JSXIdentifier;
  value: JSXExpressionContainer | { type: 'Literal'; value: unknown } | null;
  parent: JSXOpeningElement;
}

export const IME_CAPABLE_ELEMENTS = new Set(['input', 'textarea']);

const getJsxMemberExpressionName = (node: JSXMemberExpression): string => {
  const parts: string[] = [node.property.name];
  let current: JSXIdentifier | JSXMemberExpression = node.object;
  while (current.type === 'JSXMemberExpression') {
    parts.unshift(current.property.name);
    current = current.object;
  }
  parts.unshift(current.name);
  return parts.join('.');
};

const CONTENTEDITABLE_PROPS = new Set(['contenteditable', 'contentEditable']);
const PASCAL_CASE_PATTERN = /^[A-Z]/;
const CUSTOM_ELEMENT_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

const isExplicitFalseContentEditableValue = (value: JSXAttribute['value']) => {
  if (value === null) {
    return false;
  }

  if (value.type === 'Literal') {
    return value.value === 'false';
  }

  return (
    value.expression !== null &&
    value.expression.type === 'Literal' &&
    (value.expression.value === false || value.expression.value === 'false')
  );
};

export type JsxComponentsOption = {
  default: 'check' | 'ignore';
  allowComponents: string[];
  disallowComponents: string[];
};

export type CustomElementsOption = {
  default: 'check' | 'ignore';
  allowElements: string[];
  disallowElements: string[];
};

const resolveJsxComponent = ({ name, option }: { name: string; option: JsxComponentsOption }): boolean => {
  if (option.disallowComponents.includes(name)) {
    return true;
  }
  if (option.allowComponents.includes(name)) {
    return false;
  }
  return option.default === 'check';
};

const resolveCustomElement = ({ name, option }: { name: string; option: CustomElementsOption }): boolean => {
  if (option.disallowElements.includes(name)) {
    return true;
  }
  if (option.allowElements.includes(name)) {
    return false;
  }
  return option.default === 'check';
};

export const isImeCapableJsxElement = ({
  openingElement,
  jsxComponents,
  customElements,
}: {
  openingElement: JSXOpeningElement;
  jsxComponents: JsxComponentsOption;
  customElements: CustomElementsOption;
}) => {
  const { name: nameNode, attributes } = openingElement;

  if (nameNode.type === 'JSXMemberExpression') {
    const fullName = getJsxMemberExpressionName(nameNode);
    return resolveJsxComponent({ name: fullName, option: jsxComponents });
  }

  if (nameNode.type !== 'JSXIdentifier') {
    return true;
  }

  const elementName = nameNode.name;

  if (PASCAL_CASE_PATTERN.test(elementName)) {
    return resolveJsxComponent({ name: elementName, option: jsxComponents });
  }

  if (CUSTOM_ELEMENT_PATTERN.test(elementName)) {
    return resolveCustomElement({ name: elementName, option: customElements });
  }

  if (IME_CAPABLE_ELEMENTS.has(elementName)) {
    return true;
  }

  return attributes.some((attr) => {
    if (attr.type !== 'JSXAttribute') {
      return false;
    }

    if (attr.name.type !== 'JSXIdentifier' || !CONTENTEDITABLE_PROPS.has(attr.name.name)) {
      return false;
    }

    if (isExplicitFalseContentEditableValue(attr.value)) {
      return false;
    }

    return true;
  });
};

export const FUNCTION_TYPES = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration']);

const ENTER_STRING_PROPS = ['key', 'code'] as const;
const LEGACY_CODE_PROPS = ['keyCode', 'which'] as const;

export const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);
/** keypress is deprecated: e.isComposing does not exempt it from the rule. */
export const DEPRECATED_KEY_EVENTS = new Set(['keypress']);
export const JSX_KEY_EVENTS = new Set(['onKeyDown', 'onKeyUp', 'onKeyPress', 'onkeydown', 'onkeyup', 'onkeypress']);
export const DEPRECATED_JSX_KEY_EVENTS = new Set(['onKeyPress', 'onkeypress']);

/**
 * Returns true if `node` is the event parameter directly (`e`) or specifically
 * `e.nativeEvent`. No other chain depths are accepted — `e.target`, `e.detail`,
 * etc. are event-derived but do not carry the same key/isComposing semantics.
 */
const isEventParamRoot = ({ node, eventParamName }: { node: Node; eventParamName: string }) => {
  if (node.type === 'Identifier') {
    return node.name === eventParamName;
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'nativeEvent'
  ) {
    const obj = node.object;
    return obj.type === 'Identifier' && obj.name === eventParamName;
  }
  return false;
};

/**
 * Returns true if `node` is `<eventParamName>.<propName>` or a deeper chain
 * like `<eventParamName>.nativeEvent.<propName>`. Returns false when
 * `eventParamName` is undefined — the event param could not be identified,
 * so we do not match rather than produce false positives.
 */
const isMemberWithProp = ({ node, propName, eventParamName }: {
  node: Node;
  propName: string;
  eventParamName: string | undefined;
}) => {
  if (node.type !== 'MemberExpression' || node.computed) {
    return false;
  }
  if (node.property.type !== 'Identifier' || node.property.name !== propName) {
    return false;
  }
  if (eventParamName === undefined) {
    return false;
  }
  return isEventParamRoot({ node: node.object as Node, eventParamName });
};

const isLiteral = ({ node, value }: { node: Node; value: string | number }) =>
  node.type === 'Literal' && node.value === value;

const makeIsEnterKeyBinaryExpression = (eventParamName: string | undefined) => (node: Node): boolean => {
  if (node.type !== 'BinaryExpression') {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== '===' && operator !== '==' && operator !== '!==' && operator !== '!=') {
    return false;
  }

  const isEnterString = ({ leftOperand, rightOperand }: { leftOperand: Node; rightOperand: Node }) =>
    ENTER_STRING_PROPS.some((prop) => isMemberWithProp({ node: leftOperand, propName: prop, eventParamName })) &&
    isLiteral({ node: rightOperand, value: 'Enter' });
  const isEnterCode = ({ leftOperand, rightOperand }: { leftOperand: Node; rightOperand: Node }) =>
    LEGACY_CODE_PROPS.some((prop) => isMemberWithProp({ node: leftOperand, propName: prop, eventParamName })) &&
    isLiteral({ node: rightOperand, value: 13 });

  return (
    isEnterString({ leftOperand: left, rightOperand: right }) ||
    isEnterString({ leftOperand: right, rightOperand: left }) ||
    isEnterCode({ leftOperand: left, rightOperand: right }) ||
    isEnterCode({ leftOperand: right, rightOperand: left })
  );
};

const makeIsEnterKeySwitchStatement = (eventParamName: string | undefined) => (node: Node): boolean => {
  if (node.type !== 'SwitchStatement') {
    return false;
  }
  const { discriminant, cases } = node;

  const hasCase = (value: string | number) =>
    cases.some(
      (switchCase) =>
        switchCase.test !== null && switchCase.test !== undefined && isLiteral({ node: switchCase.test, value }),
    );

  if (ENTER_STRING_PROPS.some((prop) => isMemberWithProp({ node: discriminant, propName: prop, eventParamName }))) {
    return hasCase('Enter');
  }
  if (LEGACY_CODE_PROPS.some((prop) => isMemberWithProp({ node: discriminant, propName: prop, eventParamName }))) {
    return hasCase(13);
  }

  return false;
};

const isNonFunctionNode = (value: unknown): value is Node =>
  value !== null && typeof value === 'object' && 'type' in value && !FUNCTION_TYPES.has((value as Node).type);

/**
 * Returns direct child AST nodes, skipping function boundaries and the
 * `parent` back-reference added by ESLint.
 */
const getChildNodes = (node: Node) => {
  const result: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }
    if (Array.isArray(value)) {
      result.push(...(value as unknown[]).filter(isNonFunctionNode));
    } else if (isNonFunctionNode(value)) {
      result.push(value);
    }
  }
  return result;
};

/**
 * Recursively walk an AST node, returning true if `predicate` matches any
 * node in the subtree. Stops at nested function boundaries and uses a visited
 * Set to guard against circular parent references.
 */
export const walkAst = ({
  predicate,
  node,
  visited = new Set<object>(),
}: {
  predicate: (node: Node) => boolean;
  node: Node | null | undefined;
  visited?: Set<object>;
}): boolean => {
  if (node === null || node === undefined || typeof node !== 'object' || visited.has(node)) {
    return false;
  }
  visited.add(node);
  return predicate(node) || getChildNodes(node).some((child) => walkAst({ predicate, node: child, visited }));
};

const makeIsEnterKeyNode = (eventParamName: string | undefined) => {
  const isEnterKeyBinaryExpression = makeIsEnterKeyBinaryExpression(eventParamName);
  const isEnterKeySwitchStatement = makeIsEnterKeySwitchStatement(eventParamName);
  return (node: Node): boolean => isEnterKeyBinaryExpression(node) || isEnterKeySwitchStatement(node);
};

export const containsEnterKeyCheck = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) =>
  walkAst({ predicate: makeIsEnterKeyNode(eventParamName), node });

const makeIsKeyCheckBinaryExpression = (eventParamName: string | undefined) => (node: Node): boolean => {
  if (node.type !== 'BinaryExpression') {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== '===' && operator !== '==' && operator !== '!==' && operator !== '!=') {
    return false;
  }
  const isKeyMember = (candidate: Node) =>
    ENTER_STRING_PROPS.some((prop) => isMemberWithProp({ node: candidate, propName: prop, eventParamName })) ||
    LEGACY_CODE_PROPS.some((prop) => isMemberWithProp({ node: candidate, propName: prop, eventParamName }));
  return isKeyMember(left) || isKeyMember(right);
};

const makeIsKeyCheckSwitchStatement = (eventParamName: string | undefined) => (node: Node): boolean => {
  if (node.type !== 'SwitchStatement') {
    return false;
  }
  const { discriminant } = node;
  return (
    ENTER_STRING_PROPS.some((prop) => isMemberWithProp({ node: discriminant, propName: prop, eventParamName })) ||
    LEGACY_CODE_PROPS.some((prop) => isMemberWithProp({ node: discriminant, propName: prop, eventParamName }))
  );
};

const makeIsKeyCheckNode = (eventParamName: string | undefined) => {
  const isKeyCheckBinaryExpression = makeIsKeyCheckBinaryExpression(eventParamName);
  const isKeyCheckSwitchStatement = makeIsKeyCheckSwitchStatement(eventParamName);
  return (node: Node): boolean => isKeyCheckBinaryExpression(node) || isKeyCheckSwitchStatement(node);
};

export const containsKeyCheck = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) =>
  walkAst({ predicate: makeIsKeyCheckNode(eventParamName), node });

const makeIsKeyCode229BinaryExpression = (eventParamName: string | undefined) => (node: Node): boolean => {
  if (node.type !== 'BinaryExpression') {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== '===' && operator !== '==') {
    return false;
  }
  return (
    (isMemberWithProp({ node: left, propName: 'keyCode', eventParamName }) && isLiteral({ node: right, value: 229 })) ||
    (isMemberWithProp({ node: right, propName: 'keyCode', eventParamName }) && isLiteral({ node: left, value: 229 }))
  );
};

export const hasKeyCode229Check = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) => {
  const isKeyCode229BinaryExpression = makeIsKeyCode229BinaryExpression(eventParamName);
  return walkAst({
    predicate: (candidateNode) =>
      candidateNode.type === 'IfStatement' &&
      walkAst({
        predicate: isKeyCode229BinaryExpression,
        node: candidateNode.test,
      }),
    node,
  });
};

export const hasIsComposingCheck = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) =>
  walkAst({
    predicate: (candidateNode) =>
      candidateNode.type === 'IfStatement' &&
      walkAst({
        predicate: (child) => isMemberWithProp({ node: child, propName: 'isComposing', eventParamName }),
        node: candidateNode.test,
      }),
    node,
  });

const MODIFIER_KEY_PROPS = ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const;

const andChainHasKeyWithModifier = ({
  node,
  containsRelevantKeyCheck,
  checkPositiveModifier,
}: {
  node: Node;
  containsRelevantKeyCheck: (node: Node | null | undefined) => boolean;
  checkPositiveModifier: (node: Node) => boolean;
}): boolean => {
  if (node.type !== 'LogicalExpression' || node.operator !== '&&') {
    return false;
  }
  const { left, right } = node;
  const leftHasRelevantKey = containsRelevantKeyCheck(left);
  const rightHasRelevantKey = containsRelevantKeyCheck(right);

  if (leftHasRelevantKey && checkPositiveModifier(right)) {
    return true;
  }
  if (rightHasRelevantKey && checkPositiveModifier(left)) {
    return true;
  }

  return (
    andChainHasKeyWithModifier({ node: left, containsRelevantKeyCheck, checkPositiveModifier }) ||
    andChainHasKeyWithModifier({ node: right, containsRelevantKeyCheck, checkPositiveModifier })
  );
};

const containsRelevantKeyCheckOutsideModifierGuard = ({
  node,
  containsRelevantKeyCheck,
  matchesRelevantKeyCheckNode,
  eventParamName,
  visited = new Set<object>(),
}: {
  node: Node | null | undefined;
  containsRelevantKeyCheck: (node: Node | null | undefined) => boolean;
  matchesRelevantKeyCheckNode: (node: Node) => boolean;
  eventParamName: string | undefined;
  visited?: Set<object>;
}): boolean => {
  if (node === null || node === undefined || typeof node !== 'object' || visited.has(node)) {
    return false;
  }
  visited.add(node);

  const isModifierMember = (candidate: Node) =>
    MODIFIER_KEY_PROPS.some((prop) => isMemberWithProp({ node: candidate, propName: prop, eventParamName }));

  const isPositiveModifier = (candidate: Node): boolean => {
    if (isModifierMember(candidate)) {
      return true;
    }
    if (candidate.type === 'LogicalExpression' && (candidate.operator === '||' || candidate.operator === '&&')) {
      return isPositiveModifier(candidate.left) && isPositiveModifier(candidate.right);
    }
    return false;
  };

  if (node.type === 'IfStatement') {
    const consequentIsModifierGuarded =
      andChainHasKeyWithModifier({ node: node.test, containsRelevantKeyCheck, checkPositiveModifier: isPositiveModifier }) ||
      isPositiveModifier(node.test);

    if (consequentIsModifierGuarded) {
      return containsRelevantKeyCheckOutsideModifierGuard({
        node: node.alternate,
        containsRelevantKeyCheck,
        matchesRelevantKeyCheckNode,
        eventParamName,
        visited,
      });
    }
  }

  return (
    matchesRelevantKeyCheckNode(node) ||
    getChildNodes(node).some((child) =>
      containsRelevantKeyCheckOutsideModifierGuard({
        node: child,
        containsRelevantKeyCheck,
        matchesRelevantKeyCheckNode,
        eventParamName,
        visited,
      }),
    )
  );
};

export const containsEnterKeyCheckOutsideModifierGuard = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) => {
  const isEnterKeyNode = makeIsEnterKeyNode(eventParamName);
  const boundContainsEnterKeyCheck = (candidate: Node | null | undefined) =>
    walkAst({ predicate: isEnterKeyNode, node: candidate });
  return containsRelevantKeyCheckOutsideModifierGuard({
    node,
    containsRelevantKeyCheck: boundContainsEnterKeyCheck,
    matchesRelevantKeyCheckNode: isEnterKeyNode,
    eventParamName,
  });
};

export const containsKeyCheckOutsideModifierGuard = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) => {
  const isKeyCheckNode = makeIsKeyCheckNode(eventParamName);
  const boundContainsKeyCheck = (candidate: Node | null | undefined) =>
    walkAst({ predicate: isKeyCheckNode, node: candidate });
  return containsRelevantKeyCheckOutsideModifierGuard({
    node,
    containsRelevantKeyCheck: boundContainsKeyCheck,
    matchesRelevantKeyCheckNode: isKeyCheckNode,
    eventParamName,
  });
};

export const hasGuardFunctionCall = ({
  node,
  guardFunctions,
}: {
  node: Node | null | undefined;
  guardFunctions: string[];
}) =>
  walkAst({
    predicate: (candidateNode) =>
      candidateNode.type === 'IfStatement' &&
      walkAst({
        predicate: (child) =>
          child.type === 'CallExpression' &&
          child.callee.type === 'Identifier' &&
          guardFunctions.includes(child.callee.name),
        node: candidateNode.test,
      }),
    node,
  });
