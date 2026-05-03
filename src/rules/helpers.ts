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

// Returns true when e.keyCode !== 229 (or 229 !== e.keyCode) appears in blocking
// position within && chains. Blocking means: when keyCode === 229, the && expression
// evaluates to false and the if-body is not entered.
const isKeyCode229InBlockingPosition = ({ node, eventParamName }: { node: Node; eventParamName: string | undefined }): boolean => {
  if (node.type === 'BinaryExpression') {
    const { operator, left, right } = node;
    if (operator !== '!==' && operator !== '!=') {
      return false;
    }
    return (
      (isMemberWithProp({ node: left, propName: 'keyCode', eventParamName }) && isLiteral({ node: right, value: 229 })) ||
      (isMemberWithProp({ node: right, propName: 'keyCode', eventParamName }) && isLiteral({ node: left, value: 229 }))
    );
  }
  if (node.type === 'LogicalExpression' && node.operator === '&&') {
    return (
      isKeyCode229InBlockingPosition({ node: node.left as Node, eventParamName }) ||
      isKeyCode229InBlockingPosition({ node: node.right as Node, eventParamName })
    );
  }
  return false;
};

export const hasKeyCode229Check = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) => {
  const isKeyCode229BinaryExpression = makeIsKeyCode229BinaryExpression(eventParamName);
  const isEnterKeyNode = makeIsEnterKeyNode(eventParamName);
  return walkAst({
    predicate: (candidateNode) => {
      if (candidateNode.type !== 'IfStatement') {
        return false;
      }
      const { test, consequent } = candidateNode;
      // Standard form: test contains e.keyCode === 229 (or 229 === e.keyCode).
      if (walkAst({ predicate: isKeyCode229BinaryExpression, node: test })) {
        return true;
      }
      // Reversed De Morgan form: test contains both !e.isComposing and e.keyCode !== 229
      // in blocking positions within && chains. This is the negation of
      // (e.isComposing || e.keyCode === 229) and guards Safari IME equally well.
      // IMPORTANT: only counts when the Enter key check is inside THIS IfStatement —
      // in the test (inline) or the consequent (wrapping). A De Morgan guard on a
      // different key (e.g. Escape) does NOT cover an Enter check that appears after
      // a separate isComposing-only guard.
      if (
        isComposingInBlockingPosition({ node: test, eventParamName }) &&
        isKeyCode229InBlockingPosition({ node: test, eventParamName })
      ) {
        return (
          walkAst({ predicate: isEnterKeyNode, node: test }) ||
          walkAst({ predicate: isEnterKeyNode, node: consequent })
        );
      }
      return false;
    },
    node,
  });
};

// Returns true when the IfStatement's consequent directly contains a return or
// throw — i.e., the branch unconditionally exits. Block bodies are accepted when
// any top-level statement is a return/throw.
const consequentHasEarlyExit = (ifNode: Node): boolean => {
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

export const hasIsComposingCheck = ({ node, eventParamName }: { node: Node | null | undefined; eventParamName: string | undefined }) =>
  walkAst({
    predicate: (candidateNode) => {
      if (candidateNode.type !== 'IfStatement') {
        return false;
      }
      const hasIsComposing = walkAst({
        predicate: (child) => isMemberWithProp({ node: child, propName: 'isComposing', eventParamName }),
        node: candidateNode.test,
      });
      if (!hasIsComposing) {
        return false;
      }
      // Inline pattern: test contains both isComposing and a key check.
      // e.g., `if (!e.isComposing && e.key === 'Enter') submit()` — safe as-is.
      if (containsKeyCheck({ node: candidateNode.test, eventParamName })) {
        return true;
      }
      // Wrapping pattern: key checks are inside the consequent.
      // e.g., `if (!e.isComposing) { if (e.key === 'Enter') submit(); }` — safe.
      if (containsKeyCheck({ node: candidateNode.consequent, eventParamName })) {
        return true;
      }
      // Pure guard pattern: must exit early so the key handler cannot run while composing.
      return consequentHasEarlyExit(candidateNode);
    },
    node,
  });

// Returns true when the expression guarantees the if-body is NOT reached while
// IME is active — i.e. `!e.isComposing` (or a compound containing it) makes the
// expression evaluate to false when composing.
//
// Only `&&` chains are traversed: `a && !e.isComposing` is safe because the `&&`
// short-circuits to false when composing. `||` is NOT safe: in
// `!e.isComposing || e.key === 'Enter'`, the `||` can be true while composing if
// the right side is truthy, so execution is NOT blocked.
const isComposingInBlockingPosition = ({ node, eventParamName }: { node: Node; eventParamName: string | undefined }): boolean => {
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return walkAst({
      predicate: (child) => isMemberWithProp({ node: child, propName: 'isComposing', eventParamName }),
      node: node.argument as Node,
    });
  }
  if (node.type === 'LogicalExpression' && node.operator === '&&') {
    return (
      isComposingInBlockingPosition({ node: node.left as Node, eventParamName }) ||
      isComposingInBlockingPosition({ node: node.right as Node, eventParamName })
    );
  }
  return false;
};

// Returns true when e.isComposing appears in a position that guarantees the
// expression evaluates to true while composing — so the surrounding if-body
// (early exit) is unconditionally reached when composing.
//
// Only `||` chains are traversed: `e.isComposing || e.keyCode === 229` is
// guaranteed true when composing because isComposing alone makes the OR true.
// `&&` is NOT guaranteed: `e.isComposing && ready` is false when ready is false,
// so the early exit is skipped and the handler continues while composing.
// `!e.isComposing` and `!e.isComposing && other` are both false while composing
// and do not guarantee the early exit either.
const isComposingInGuaranteedExitPosition = ({ node, eventParamName }: { node: Node; eventParamName: string | undefined }): boolean => {
  if (isMemberWithProp({ node, propName: 'isComposing', eventParamName })) {
    return true;
  }
  if (node.type === 'LogicalExpression' && node.operator === '||') {
    return (
      isComposingInGuaranteedExitPosition({ node: node.left as Node, eventParamName }) ||
      isComposingInGuaranteedExitPosition({ node: node.right as Node, eventParamName })
    );
  }
  return false;
};

// Returns true when the IfStatement is a pure isComposing guard: the test
// guarantees exit when composing and the consequent exits early (return/throw).
const isPureIsComposingGuardStatement = ({
  node,
  eventParamName,
}: {
  node: Node;
  eventParamName: string | undefined;
}): boolean => {
  if (node.type !== 'IfStatement') {
    return false;
  }
  if (isComposingInGuaranteedExitPosition({ node: node.test, eventParamName }) === false) {
    return false;
  }
  // If the consequent contains a key check, this is the wrapping pattern — not a pure guard.
  if (containsKeyCheck({ node: node.consequent, eventParamName })) {
    return false;
  }
  return consequentHasEarlyExit(node);
};

// Returns true when the IfStatement is a pure user-defined guard: test is exactly
// `guardFn(e)` (single event param argument) and the consequent exits early.
const isPureGuardFunctionStatement = ({
  node,
  guardFunctions,
  eventParamName,
}: {
  node: Node;
  guardFunctions: string[];
  eventParamName: string | undefined;
}): boolean => {
  if (node.type !== 'IfStatement' || eventParamName === undefined) {
    return false;
  }
  const { test } = node;
  if (
    test.type !== 'CallExpression' ||
    test.callee.type !== 'Identifier' ||
    !guardFunctions.includes(test.callee.name) ||
    test.arguments.length !== 1 ||
    test.arguments[0]?.type !== 'Identifier' ||
    test.arguments[0].name !== eventParamName
  ) {
    return false;
  }
  return consequentHasEarlyExit(node);
};

type UncoveredKeyCheckArgs = {
  node: Node | null | undefined;
  eventParamName: string | undefined;
  isKeyCheckNode: (candidateNode: Node) => boolean;
  guardFunctions: string[];
  visited: Set<object>;
};

// Iterates BlockStatement body in order, stopping after a pure guard statement
// (isComposing or user-defined guard function). Subsequent statements are only
// reached when not composing, so they are safe.
const traverseBlockForUncoveredKeyCheck = ({
  blockNode,
  eventParamName,
  isKeyCheckNode,
  guardFunctions,
  visited,
}: Omit<UncoveredKeyCheckArgs, 'node'> & { blockNode: Node }): boolean => {
  if (blockNode.type !== 'BlockStatement') {
    return false;
  }
  for (const stmt of blockNode.body) {
    if (isPureIsComposingGuardStatement({ node: stmt, eventParamName })) {
      return false; // remaining siblings are safe — handler exits while composing
    }
    if (guardFunctions.length > 0 && isPureGuardFunctionStatement({ node: stmt, guardFunctions, eventParamName })) {
      return false; // remaining siblings are safe — user-defined guard exits while composing
    }
    if (traverseForUncoveredKeyCheck({ node: stmt, eventParamName, isKeyCheckNode, guardFunctions, visited })) {
      return true;
    }
  }
  return false;
};

// Handles isComposing patterns on IfStatements. Returns true/false when the
// node is fully handled, or undefined to fall through to normal traversal.
const resolveIfStatementUncoveredKeyCheck = ({
  ifNode,
  eventParamName,
  isKeyCheckNode,
  guardFunctions,
  visited,
}: Omit<UncoveredKeyCheckArgs, 'node'> & { ifNode: Node }): boolean | undefined => {
  if (ifNode.type !== 'IfStatement') {
    return undefined;
  }
  const testHasIsComposing = walkAst({
    predicate: (child) => isMemberWithProp({ node: child, propName: 'isComposing', eventParamName }),
    node: ifNode.test,
  });
  if (testHasIsComposing) {
    // The guard is only effective when isComposing in the test *blocks* execution
    // (i.e. evaluates to false while composing). `!e.isComposing` blocks; bare
    // `e.isComposing` passes — so `if (e.isComposing) { key check }` is unsafe.
    const composingBlocks = isComposingInBlockingPosition({ node: ifNode.test, eventParamName });
    // Inline: key check in test is guarded → skip test, check only alternate
    if (composingBlocks && containsKeyCheck({ node: ifNode.test, eventParamName })) {
      return traverseForUncoveredKeyCheck({ node: ifNode.alternate, eventParamName, isKeyCheckNode, guardFunctions, visited });
    }
    // Wrapping: key checks in consequent are guarded → skip consequent, check only alternate
    if (composingBlocks && containsKeyCheck({ node: ifNode.consequent, eventParamName })) {
      return traverseForUncoveredKeyCheck({ node: ifNode.alternate, eventParamName, isKeyCheckNode, guardFunctions, visited });
    }
    return undefined; // unrecognized isComposing pattern — fall through
  }
  // Nested pattern: `if (e.key === 'Enter') { if (e.isComposing) return; submit(); }`
  // The test has a key check and the FIRST statement of the consequent is a pure
  // guard. The guard must be first — any statement before it executes while
  // composing, making the pattern unsafe:
  //   `if (e.key === 'Enter') { submit(); if (e.isComposing) return; }` is NOT safe.
  const testHasKeyCheck = containsKeyCheck({ node: ifNode.test, eventParamName });
  if (testHasKeyCheck) {
    const firstConsequentStmt = ifNode.consequent.type === 'BlockStatement'
      ? ifNode.consequent.body[0]
      : ifNode.consequent;
    const firstIsGuard =
      firstConsequentStmt !== undefined &&
      (
        isPureIsComposingGuardStatement({ node: firstConsequentStmt, eventParamName }) ||
        (guardFunctions.length > 0 && isPureGuardFunctionStatement({ node: firstConsequentStmt, guardFunctions, eventParamName }))
      );
    if (firstIsGuard) {
      return traverseForUncoveredKeyCheck({ node: ifNode.alternate, eventParamName, isKeyCheckNode, guardFunctions, visited });
    }
  }
  return undefined; // no recognized pattern — fall through
};

const traverseForUncoveredKeyCheck = ({ node, eventParamName, isKeyCheckNode, guardFunctions, visited }: UncoveredKeyCheckArgs): boolean => {
  if (node === null || node === undefined || typeof node !== 'object' || visited.has(node)) {
    return false;
  }
  visited.add(node);
  if (FUNCTION_TYPES.has(node.type)) {
    return false;
  }
  if (node.type === 'BlockStatement') {
    return traverseBlockForUncoveredKeyCheck({ blockNode: node, eventParamName, isKeyCheckNode, guardFunctions, visited });
  }
  if (node.type === 'IfStatement') {
    const handled = resolveIfStatementUncoveredKeyCheck({ ifNode: node, eventParamName, isKeyCheckNode, guardFunctions, visited });
    if (handled !== undefined) {
      return handled;
    }
  }
  if (isKeyCheckNode(node)) {
    return true;
  }
  return getChildNodes(node).some((child) =>
    traverseForUncoveredKeyCheck({ node: child, eventParamName, isKeyCheckNode, guardFunctions, visited }),
  );
};

// Returns true if the handler body contains a key check that is NOT covered by
// an isComposing guard (pure, inline, wrapping, or nested pattern) or by a
// user-defined guard function from the guardFunctions option.
export const containsKeyCheckOutsideIsComposingGuard = ({
  node,
  eventParamName,
  guardFunctions = [],
}: {
  node: Node | null | undefined;
  eventParamName: string | undefined;
  guardFunctions?: string[];
}): boolean =>
  traverseForUncoveredKeyCheck({
    node,
    eventParamName,
    isKeyCheckNode: makeIsKeyCheckNode(eventParamName),
    guardFunctions,
    visited: new Set<object>(),
  });

export const containsEnterKeyCheckOutsideIsComposingGuard = ({
  node,
  eventParamName,
  guardFunctions = [],
}: {
  node: Node | null | undefined;
  eventParamName: string | undefined;
  guardFunctions?: string[];
}): boolean =>
  traverseForUncoveredKeyCheck({
    node,
    eventParamName,
    isKeyCheckNode: makeIsEnterKeyNode(eventParamName),
    guardFunctions,
    visited: new Set<object>(),
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
  eventParamName,
}: {
  node: Node | null | undefined;
  guardFunctions: string[];
  eventParamName: string | undefined;
}) => {
  if (eventParamName === undefined) {
    return false;
  }
  return walkAst({
    predicate: (candidateNode) => {
      if (candidateNode.type !== 'IfStatement') {
        return false;
      }
      const { test } = candidateNode;
      // Test must be exactly `guardFn(e)` — no negation, no compound conditions.
      // This ensures the guard unconditionally covers the composing case.
      if (
        test.type !== 'CallExpression' ||
        test.callee.type !== 'Identifier' ||
        !guardFunctions.includes(test.callee.name) ||
        test.arguments.length !== 1 ||
        test.arguments[0]?.type !== 'Identifier' ||
        test.arguments[0].name !== eventParamName
      ) {
        return false;
      }
      // Require early exit so the key handler cannot run after the guard.
      return consequentHasEarlyExit(candidateNode);
    },
    node,
  });
};
