import type { Rule } from "eslint";
import type { BaseNode, Node } from "estree";

// ESLint does not ship JSX node types, so we define the minimal shape we need.
interface JSXIdentifier extends BaseNode {
  type: "JSXIdentifier";
  name: string;
}

interface JSXExpressionContainer extends BaseNode {
  type: "JSXExpressionContainer";
  expression: Node | null;
}

interface JSXAttribute extends BaseNode {
  type: "JSXAttribute";
  name: JSXIdentifier;
  value: JSXExpressionContainer | null;
}

const FUNCTION_TYPES = new Set(["FunctionExpression", "ArrowFunctionExpression", "FunctionDeclaration"]);

const ENTER_STRING_PROPS = ["key", "code"] as const;
const LEGACY_CODE_PROPS = ["keyCode", "which"] as const;

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
const walkAst = ({
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

const containsEnterKeyCheck = (node: Node | null | undefined) => walkAst({ predicate: isEnterKeyNode, node });

/**
 * Returns true if the handler body contains an IfStatement whose condition
 * references `e.isComposing` — the author is handling IME input correctly.
 * Checking only IfStatement tests (rather than any `.isComposing` reference)
 * avoids false-negatives where isComposing is used unrelated to guarding.
 */
const hasIsComposingCheck = (node: Node | null | undefined) =>
  walkAst({
    predicate: (n) =>
      n.type === "IfStatement" &&
      walkAst({
        predicate: (child) => isMemberWithProp({ node: child, propName: "isComposing" }),
        node: n.test,
      }),
    node,
  });

const KEY_EVENTS = new Set(["keydown", "keyup", "keypress"]);
// keypress is deprecated: e.isComposing does not exempt it from the rule.
const DEPRECATED_KEY_EVENTS = new Set(["keypress"]);
const JSX_KEY_EVENTS = new Set(["onKeyDown", "onKeyUp", "onKeyPress"]);
const DEPRECATED_JSX_KEY_EVENTS = new Set(["onKeyPress"]);

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require IME-safe form submission. Disallow Enter key detection in keydown/keyup without an e.isComposing guard, and prohibit keypress entirely.",
      recommended: true,
      url: "https://github.com/hiroya-uga/eslint-plugin-ime-safe-form/blob/main/docs/rules/require-ime-safe-submit.md",
    },
    messages: {
      requireImeSafeSubmit:
        "Enter key detected in '{{eventName}}' without an IME composition guard. " +
        "Add 'if (e.isComposing) return;' before the check, or handle submission via the form's 'submit' event.",
      keypressProhibited:
        "'keypress' is deprecated. Use 'keydown' with an e.isComposing guard instead, or handle submission via the form's 'submit' event.",
    },
    schema: [],
  },

  create(context) {
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
      if (handlerNode.type !== "ArrowFunctionExpression" && handlerNode.type !== "FunctionExpression") {
        return;
      }

      const body = handlerNode.body;

      if (allowIsComposingGuard && hasIsComposingCheck(body)) {
        return;
      }

      if (containsEnterKeyCheck(body)) {
        context.report({
          node: reportNode,
          messageId: allowIsComposingGuard ? "requireImeSafeSubmit" : "keypressProhibited",
          data: { eventName },
        });
      }
    };

    return {
      // Pattern 1: element.addEventListener('keydown' | 'keyup' | 'keypress', handler)
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.property.type !== "Identifier" ||
          callee.property.name !== "addEventListener" ||
          args.length < 2
        ) {
          return;
        }

        const eventArg = args[0];
        if (eventArg === undefined) {
          return;
        }
        if (eventArg.type !== "Literal" || typeof eventArg.value !== "string" || !KEY_EVENTS.has(eventArg.value)) {
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
        if (left.type !== "MemberExpression" || left.computed || left.property.type !== "Identifier") {
          return;
        }

        const propName = left.property.name.toLowerCase();
        if (propName !== "onkeydown" && propName !== "onkeyup" && propName !== "onkeypress") {
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
        if (node.name.type !== "JSXIdentifier" || !JSX_KEY_EVENTS.has(node.name.name)) {
          return;
        }

        const value = node.value;
        if (value?.type !== "JSXExpressionContainer") {
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
