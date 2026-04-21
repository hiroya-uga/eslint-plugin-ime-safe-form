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

export const isString = (item: unknown): item is string => typeof item === 'string';

export const IME_CAPABLE_ELEMENTS = new Set(['input', 'textarea', 'select']);

const CONTENTEDITABLE_PROPS = new Set(['contenteditable', 'contentEditable']);
const PASCAL_CASE_PATTERN = /^[A-Z]/;

export const isImeCapableJsxElement = ({
  openingElement,
  allowComponents,
}: {
  openingElement: JSXOpeningElement;
  allowComponents: string[];
}) => {
  const { name: nameNode, attributes } = openingElement;

  if (nameNode.type !== 'JSXIdentifier') {
    return true;
  }

  const elementName = nameNode.name;

  if (PASCAL_CASE_PATTERN.test(elementName)) {
    return !allowComponents.includes(elementName);
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

    if (attr.value !== null && attr.value.type === 'Literal' && attr.value.value === 'false') {
      return false;
    }

    return true;
  });
};

export const FUNCTION_TYPES = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration']);

const ENTER_STRING_PROPS = ['key', 'code'] as const;
const LEGACY_CODE_PROPS = ['keyCode', 'which'] as const;

export const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);
// keypress is deprecated: e.isComposing does not exempt it from the rule.
export const DEPRECATED_KEY_EVENTS = new Set(['keypress']);
export const JSX_KEY_EVENTS = new Set(['onKeyDown', 'onKeyUp', 'onKeyPress']);
export const DEPRECATED_JSX_KEY_EVENTS = new Set(['onKeyPress']);

const isMemberWithProp = ({ node, propName }: { node: Node; propName: string }) =>
  node.type === 'MemberExpression' &&
  !node.computed &&
  node.property.type === 'Identifier' &&
  node.property.name === propName;

const isLiteral = ({ node, value }: { node: Node; value: string | number }) =>
  node.type === 'Literal' && node.value === value;

/**
 * Check if a BinaryExpression is an Enter key check:
 *   e.key === 'Enter'  / e.key == 'Enter'
 *   e.key !== 'Enter'  / e.key != 'Enter'   ← early-return pattern
 *   e.code === 'Enter' / e.code == 'Enter'
 *   e.code !== 'Enter' / e.code != 'Enter'
 *   e.keyCode === 13   / e.keyCode == 13
 *   e.keyCode !== 13   / e.keyCode != 13
 *   e.which === 13     / e.which == 13
 *   e.which !== 13     / e.which != 13
 * (and reversed operand order)
 */
const isEnterKeyBinaryExpression = (node: Node) => {
  if (node.type !== 'BinaryExpression') {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== '===' && operator !== '==' && operator !== '!==' && operator !== '!=') {
    return false;
  }

  const isEnterString = ({ leftOperand, rightOperand }: { leftOperand: Node; rightOperand: Node }) =>
    ENTER_STRING_PROPS.some((prop) => isMemberWithProp({ node: leftOperand, propName: prop })) &&
    isLiteral({ node: rightOperand, value: 'Enter' });
  const isEnterCode = ({ leftOperand, rightOperand }: { leftOperand: Node; rightOperand: Node }) =>
    LEGACY_CODE_PROPS.some((prop) => isMemberWithProp({ node: leftOperand, propName: prop })) &&
    isLiteral({ node: rightOperand, value: 13 });

  return (
    isEnterString({ leftOperand: left, rightOperand: right }) ||
    isEnterString({ leftOperand: right, rightOperand: left }) ||
    isEnterCode({ leftOperand: left, rightOperand: right }) ||
    isEnterCode({ leftOperand: right, rightOperand: left })
  );
};

/**
 * Check if a SwitchStatement is an Enter key check:
 *   switch(e.key)     { case 'Enter': ... }
 *   switch(e.code)    { case 'Enter': ... }
 *   switch(e.keyCode) { case 13: ... }
 *   switch(e.which)   { case 13: ... }
 */
const isEnterKeySwitchStatement = (node: Node) => {
  if (node.type !== 'SwitchStatement') {
    return false;
  }
  const { discriminant, cases } = node;

  const hasCase = (value: string | number) =>
    cases.some(
      (switchCase) =>
        switchCase.test !== null && switchCase.test !== undefined && isLiteral({ node: switchCase.test, value }),
    );

  if (ENTER_STRING_PROPS.some((prop) => isMemberWithProp({ node: discriminant, propName: prop }))) {
    return hasCase('Enter');
  }
  if (LEGACY_CODE_PROPS.some((prop) => isMemberWithProp({ node: discriminant, propName: prop }))) {
    return hasCase(13);
  }

  return false;
};

/**
 * Returns direct child AST nodes, skipping function boundaries and the
 * `parent` back-reference added by ESLint.
 */
const isNonFunctionNode = (value: unknown): value is Node =>
  value !== null && typeof value === 'object' && 'type' in value && !FUNCTION_TYPES.has((value as Node).type);

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

const isEnterKeyNode = (node: Node) => isEnterKeyBinaryExpression(node) || isEnterKeySwitchStatement(node);

export const containsEnterKeyCheck = (node: Node | null | undefined) => walkAst({ predicate: isEnterKeyNode, node });

/**
 * Check if a BinaryExpression is a keyCode === 229 check (Safari IME guard):
 *   e.keyCode === 229  /  e.keyCode == 229  (and reversed operand order)
 */
const isKeyCode229BinaryExpression = (node: Node) => {
  if (node.type !== 'BinaryExpression') {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== '===' && operator !== '==') {
    return false;
  }
  return (
    (isMemberWithProp({ node: left, propName: 'keyCode' }) && isLiteral({ node: right, value: 229 })) ||
    (isMemberWithProp({ node: right, propName: 'keyCode' }) && isLiteral({ node: left, value: 229 }))
  );
};

/**
 * Returns true if the handler body contains an IfStatement whose condition
 * includes a keyCode === 229 check — the Safari IME workaround.
 * In Safari, compositionend fires before the final keydown, so e.isComposing
 * is already false when Enter is pressed to confirm IME. keyCode 229 covers
 * this gap (deprecated but still reliable for this purpose).
 */
export const hasKeyCode229Check = (node: Node | null | undefined) =>
  walkAst({
    predicate: (candidateNode) =>
      candidateNode.type === 'IfStatement' &&
      walkAst({
        predicate: (child) => isKeyCode229BinaryExpression(child),
        node: candidateNode.test,
      }),
    node,
  });

/**
 * Returns true if the handler body contains an IfStatement whose condition
 * references `e.isComposing` — the author is handling IME input correctly.
 * Checking only IfStatement tests (rather than any `.isComposing` reference)
 * avoids false-negatives where isComposing is used unrelated to guarding.
 */
export const hasIsComposingCheck = (node: Node | null | undefined) =>
  walkAst({
    predicate: (candidateNode) =>
      candidateNode.type === 'IfStatement' &&
      walkAst({
        predicate: (child) => isMemberWithProp({ node: child, propName: 'isComposing' }),
        node: candidateNode.test,
      }),
    node,
  });

const MODIFIER_KEY_PROPS = ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const;

const isModifierKeyMemberExpression = (node: Node) =>
  MODIFIER_KEY_PROPS.some((prop) => isMemberWithProp({ node, propName: prop }));

/**
 * Returns true only for expressions that positively assert a modifier key is
 * held — i.e., the IME cannot be composing. Negated checks like `!e.ctrlKey`
 * are intentionally rejected.
 *
 *   e.ctrlKey                   → true
 *   e.ctrlKey || e.metaKey      → true
 *   !e.ctrlKey                  → false  (does not prevent IME)
 *   e.key === 'Enter'           → false
 */
const isPositiveModifierExpression = (node: Node): boolean => {
  if (isModifierKeyMemberExpression(node)) {
    return true;
  }
  if (node.type === 'LogicalExpression' && node.operator === '||') {
    return isPositiveModifierExpression(node.left) && isPositiveModifierExpression(node.right);
  }
  return false;
};

/**
 * Returns true if the LogicalExpression subtree (connected by &&) has one side
 * containing an Enter key check and the other side being a positive modifier
 * expression. Recursively handles chained &&.
 *
 *   e.key === 'Enter' && e.ctrlKey               → true
 *   e.ctrlKey && e.key === 'Enter'               → true
 *   e.key === 'Enter' && (e.ctrlKey || e.metaKey) → true
 *   e.key === 'Enter' && !e.shiftKey              → false (!modifier ≠ IME guard)
 */
const andChainHasEnterWithModifier = (node: Node): boolean => {
  if (node.type !== 'LogicalExpression' || node.operator !== '&&') {
    return false;
  }
  const { left, right } = node;
  const leftHasEnter = walkAst({ predicate: isEnterKeyNode, node: left });
  const rightHasEnter = walkAst({ predicate: isEnterKeyNode, node: right });

  if (leftHasEnter && isPositiveModifierExpression(right)) {
    return true;
  }
  if (rightHasEnter && isPositiveModifierExpression(left)) {
    return true;
  }

  return andChainHasEnterWithModifier(left) || andChainHasEnterWithModifier(right);
};

/**
 * Returns true if the handler body contains a modifier-key guard that makes
 * IME composition impossible. When a modifier key (Ctrl, Meta, Shift, Alt) is
 * held, the IME cannot be in composition state, so e.isComposing is always
 * false and no guard is needed.
 *
 * Pattern A — Enter + modifier in the same && condition:
 *   if (e.key === 'Enter' && e.ctrlKey) …
 *   if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) …
 *
 * Pattern B — outer if whose test is a positive modifier expression, with an
 * Enter check inside the body:
 *   if (e.ctrlKey) { if (e.key === 'Enter') … }
 */
export const hasModifierKeyGuard = (node: Node | null | undefined) =>
  walkAst({
    predicate: (candidateNode) => {
      if (candidateNode.type !== 'IfStatement') {
        return false;
      }

      const { test, consequent } = candidateNode;

      if (andChainHasEnterWithModifier(test)) {
        return true;
      }

      return isPositiveModifierExpression(test) && containsEnterKeyCheck(consequent);
    },
    node,
  });

/**
 * Returns true if the handler body contains an IfStatement whose condition
 * calls one of the specified guard function names. This allows users to
 * extract the isComposing guard into a helper and declare it via the
 * `guardFunctions` option.
 *
 *   const guardIsComposing = (e) => e.isComposing || e.keyCode === 229;
 *   input.addEventListener('keydown', (e) => {
 *     if (guardIsComposing(e)) return;  ← recognised as a guard
 *     if (e.key === 'Enter') submit();
 *   });
 */
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
