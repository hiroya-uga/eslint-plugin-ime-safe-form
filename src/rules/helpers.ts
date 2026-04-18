import type { BaseNode, Node } from "estree";

// ESLint does not ship JSX node types, so we define the minimal shape we need.
export interface JSXIdentifier extends BaseNode {
  type: "JSXIdentifier";
  name: string;
}

export interface JSXExpressionContainer extends BaseNode {
  type: "JSXExpressionContainer";
  expression: Node | null;
}

export interface JSXAttribute extends BaseNode {
  type: "JSXAttribute";
  name: JSXIdentifier;
  value: JSXExpressionContainer | null;
}

export const FUNCTION_TYPES = new Set(["FunctionExpression", "ArrowFunctionExpression", "FunctionDeclaration"]);

const ENTER_STRING_PROPS = ["key", "code"] as const;
const LEGACY_CODE_PROPS = ["keyCode", "which"] as const;

export const KEY_EVENTS = new Set(["keydown", "keyup", "keypress"]);
// keypress is deprecated: e.isComposing does not exempt it from the rule.
export const DEPRECATED_KEY_EVENTS = new Set(["keypress"]);
export const JSX_KEY_EVENTS = new Set(["onKeyDown", "onKeyUp", "onKeyPress"]);
export const DEPRECATED_JSX_KEY_EVENTS = new Set(["onKeyPress"]);

const isMemberWithProp = ({ node, propName }: { node: Node; propName: string }) =>
  node.type === "MemberExpression" &&
  !node.computed &&
  node.property.type === "Identifier" &&
  node.property.name === propName;

const isLiteral = ({ node, value }: { node: Node; value: string | number }) =>
  node.type === "Literal" && node.value === value;

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
  if (node.type !== "BinaryExpression") {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== "===" && operator !== "==" && operator !== "!==" && operator !== "!=") {
    return false;
  }

  const isEnterString = ({ left, right }: { left: Node; right: Node }) =>
    ENTER_STRING_PROPS.some((p) => isMemberWithProp({ node: left, propName: p })) &&
    isLiteral({ node: right, value: "Enter" });
  const isEnterCode = ({ left, right }: { left: Node; right: Node }) =>
    LEGACY_CODE_PROPS.some((p) => isMemberWithProp({ node: left, propName: p })) &&
    isLiteral({ node: right, value: 13 });

  return (
    isEnterString({ left, right }) ||
    isEnterString({ left: right, right: left }) ||
    isEnterCode({ left, right }) ||
    isEnterCode({ left: right, right: left })
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
  if (node.type !== "SwitchStatement") {
    return false;
  }
  const { discriminant, cases } = node;

  const hasCase = (value: string | number) =>
    cases.some((c) => c.test !== null && c.test !== undefined && isLiteral({ node: c.test, value }));

  if (ENTER_STRING_PROPS.some((p) => isMemberWithProp({ node: discriminant, propName: p }))) {
    return hasCase("Enter");
  }
  if (LEGACY_CODE_PROPS.some((p) => isMemberWithProp({ node: discriminant, propName: p }))) {
    return hasCase(13);
  }

  return false;
};

/**
 * Returns direct child AST nodes, skipping function boundaries and the
 * `parent` back-reference added by ESLint.
 */
const isNonFunctionNode = (value: unknown): value is Node =>
  value !== null && typeof value === "object" && "type" in value && !FUNCTION_TYPES.has((value as Node).type);

const getChildNodes = (node: Node) => {
  const result: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") {
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
  if (node === null || node === undefined || typeof node !== "object" || visited.has(node)) {
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
  if (node.type !== "BinaryExpression") {
    return false;
  }
  const { operator, left, right } = node;
  if (operator !== "===" && operator !== "==") {
    return false;
  }
  return (
    (isMemberWithProp({ node: left, propName: "keyCode" }) && isLiteral({ node: right, value: 229 })) ||
    (isMemberWithProp({ node: right, propName: "keyCode" }) && isLiteral({ node: left, value: 229 }))
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
    predicate: (n) =>
      n.type === "IfStatement" &&
      walkAst({
        predicate: (child) => isKeyCode229BinaryExpression(child),
        node: n.test,
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
    predicate: (n) =>
      n.type === "IfStatement" &&
      walkAst({
        predicate: (child) => isMemberWithProp({ node: child, propName: "isComposing" }),
        node: n.test,
      }),
    node,
  });
