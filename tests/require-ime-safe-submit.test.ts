import { RuleTester } from 'eslint';
import rule = require('../src/rules/require-ime-safe-submit');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('require-ime-safe-submit', rule, {
  valid: [
    // ── form submit event — correct pattern ──────────────────────────────────
    {
      code: `form.addEventListener('submit', (e) => { e.preventDefault(); send(); });`,
    },
    // ── keydown / keyup with isComposing guard — non-Enter key ───────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Escape') close(); });`,
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Tab') focusNext(); });`,
    },
    // switch on non-Enter key with isComposing guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; switch(e.key) { case 'Escape': close(); break; } });`,
    },
    // click event — unrelated
    {
      code: `btn.addEventListener('click', () => submit());`,
    },
    // ── JSX onSubmit — correct ───────────────────────────────────────────────
    {
      code: `<form onSubmit={(e) => { e.preventDefault(); send(); }} />`,
    },
    // ── isComposing + keyCode 229 guard (default) ────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submitForm(); }} />;`,
    },
    {
      code: `input.onkeydown = (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); };`,
    },
    // ── e.nativeEvent.isComposing (React synthetic event workaround) ─────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return; if (e.nativeEvent.key === 'Enter') submit(); });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return; if (e.nativeEvent.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `input.onkeydown = (e) => { if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return; if (e.nativeEvent.key === 'Enter') submit(); };`,
    },
    // ── isComposing guard only (checkKeyCodeForSafari: false) ────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing) return; if (e.key === 'Enter') submitForm(); }} />;`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `input.onkeydown = (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); };`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // e.nativeEvent.isComposing with checkKeyCodeForSafari: false
    {
      code: `input.addEventListener('keydown', (e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Enter') submit(); }} />;`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // isComposing guard nested inside the Enter check
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (e.isComposing) return; submit(); } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // isComposing in logical AND: !e.isComposing && e.key === 'Enter'
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // isComposing in logical AND (reversed): e.key === 'Enter' && !e.isComposing
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // isComposing guard in outer if block (wraps the Enter check)
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) { if (e.key === 'Enter') submit(); } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── Enter check inside a nested function — out of scope ──────────────────
    {
      code: `input.addEventListener('keydown', (e) => { setTimeout(() => { if (e.key === 'Enter') submit(); }, 0); });`,
    },
    // ── Named function reference — cannot statically analyze external body ───
    {
      code: `input.addEventListener('keydown', handleKeydown);`,
    },
    {
      code: `input.addEventListener('keyup', handleKeyup);`,
    },
    {
      code: `input.addEventListener('keypress', handleKeypress);`,
    },
    {
      code: `input.onkeydown = handleKeydown;`,
    },
    {
      code: `<input onKeyDown={handleKeydown} />;`,
    },
    // ── Known limitation: destructured event parameter — not detected ─────────
    // The rule only recognises e.key / e.code / e.keyCode / e.which as
    // MemberExpressions. Destructured bindings are plain Identifiers and are
    // invisible to the rule. Use eslint-disable if this pattern is intentional.
    {
      code: `input.addEventListener('keydown', ({ key }) => { if (key === 'Enter') submit(); });`,
    },
    // ── window.onkeydown — with isComposing guard ─────────────────────────────
    {
      code: `window.onkeydown = (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Escape') close(); };`,
    },
    // ── isComposing guard with switch statement ───────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; switch(e.key) { case 'Enter': submit(); break; } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── onkeyup assignment with isComposing guard ────────────────────────────
    {
      code: `input.onkeyup = (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); };`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── isComposing guard with legacy keyCode / which ────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.keyCode === 13) submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.which == 13) submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── JSX onKeyUp with isComposing guard ───────────────────────────────────
    {
      code: `<input onKeyUp={(e) => { if (e.isComposing) return; if (e.key === 'Enter') submitForm(); }} />;`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── isComposing guard with switch statement (keyup) ───────────────────────
    {
      code: `input.addEventListener('keyup', (e) => { if (e.isComposing) return; switch(e.key) { case 'Enter': submit(); break; } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── !== / != early-return pattern with isComposing guard ─────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key !== 'Enter') return; submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.keyCode != 13) return; submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── window.addEventListener — same rules apply ────────────────────────────
    {
      code: `window.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // checkKeyCodeForSafari: true (explicit) — keyup variant
    {
      code: `input.addEventListener('keyup', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: true }],
    },
    // separate if statements for each guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
    // reversed operand: 229 === e.keyCode
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || 229 === e.keyCode) return; if (e.key === 'Enter') submit(); });`,
    },
    // onkeyup assignment
    {
      code: `input.onkeyup = (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); };`,
    },
    // JSX onKeyUp
    {
      code: `<input onKeyUp={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
    },
    // no Enter check — no error even without keyCode 229
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Escape') close(); });`,
    },
    // ── modifier key guard — IME cannot compose while a modifier is held ────────
    // Pattern A: Enter + modifier in same && condition
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.metaKey) submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.shiftKey) submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.altKey) submit(); });`,
    },
    // reversed operand order
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') submit(); });`,
    },
    // non-Enter shortcut with modifier is also safe
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'k') openPalette(); });`,
    },
    // multiple modifiers with ||
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); });`,
    },
    // multiple modifiers with && — requiring both is also safe; IME cannot compose
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey && e.metaKey)) submit(); });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey && e.metaKey)) submitForm(); }} />;`,
    },
    // legacy keyCode
    {
      code: `input.addEventListener('keydown', (e) => { if (e.keyCode === 13 && e.ctrlKey) submit(); });`,
    },
    // keyup
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); });`,
    },
    // onkeydown assignment
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); };`,
    },
    // JSX
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitForm(); }} />;`,
    },
    {
      code: `<input onKeyUp={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitForm(); }} />;`,
    },
    // Pattern B: outer if with modifier, Enter check inside
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey) { if (e.key === 'Enter') submit(); } });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey) { switch(e.key) { case 'Enter': submit(); break; } } });`,
    },
    // checkKeyCodeForSafari: false — modifier guard still exempts
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // isComposing guard + modifier-gated Enter — requireKeyCode229 must not fire
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter' && e.ctrlKey) submit(); });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing) return; if (e.key === 'Enter' && e.ctrlKey) submitForm(); }} />;`,
    },
    // ── allowComponents option — named components are not flagged ─────────────
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['MyInput'] }],
    },
    {
      code: `<MyInput onKeyUp={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['MyInput'] }],
    },
    {
      code: `<MyInput onKeyPress={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['MyInput'] }],
    },
    // multiple names — second matches
    {
      code: `<SearchField onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['MyInput', 'SearchField'] }],
    },
    // ── allowComponents with dot-notation (JSXMemberExpression) ─────────────
    {
      code: `<UI.Input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['UI.Input'] }],
    },
    {
      code: `<Form.Field onKeyUp={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['Form.Field'] }],
    },
    // deeply nested dot-notation
    {
      code: `<A.B.C onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['A.B.C'] }],
    },
    // ── JSX non-input HTML elements — not IME-capable, not flagged ────────────
    {
      code: `<div onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<button onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<span onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    // contentEditable="false" — explicitly not editable
    {
      code: `<div contentEditable="false" onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<div contenteditable="false" onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    // contentEditable={false} boolean expression — also not editable
    {
      code: `<div contentEditable={false} onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<div contenteditable={false} onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    // contentEditable={'false'} string expression — also not editable
    {
      code: `<div contentEditable={'false'} onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<div contenteditable={'false'} onKeyDown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    // ── guardFunctions option ──────────────────────────────────────────────────
    // basic: named guard function exempts keydown Enter check
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
    },
    // keyup
    {
      code: `input.addEventListener('keyup', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
    },
    // onkeydown assignment
    {
      code: `input.onkeydown = (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); };`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
    },
    // JSX onKeyDown
    {
      code: `<input onKeyDown={(e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); }} />;`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
    },
    // multiple guard function names — second name matches
    {
      code: `input.addEventListener('keydown', (e) => { if (isComposingGuard(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing", "isComposingGuard"] }],
    },
    // combined with checkKeyCodeForSafari: false — no requireKeyCode229 report
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"], checkKeyCodeForSafari: false }],
    },
    // ── camelCase DOM assignment (onKeyDown, onKeyUp) — not a valid DOM API ─────
    // DOM properties are case-sensitive: the valid form is onkeydown (lowercase).
    // onKeyDown is a React JSX prop, not a DOM property, so assignment via = is
    // not a recognized pattern and is intentionally not flagged.
    {
      code: `input.onKeyDown = (e) => { if (e.key === 'Enter') submit(); };`,
    },
    {
      code: `input.onKeyUp = (e) => { if (e.key === 'Enter') submit(); };`,
    },
    // ── lowercase JSX event attributes (onkeydown / onkeyup / onkeypress) ───────
    {
      code: `<input onkeydown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `<input onkeyup={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `<input onkeydown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // non-IME-capable element with lowercase event — never flagged
    {
      code: `<div onkeydown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    {
      code: `<button onkeydown={(e) => { if (e.key === 'Enter') someAction(); }} />;`,
    },
    // ── customElements option — default: 'ignore' (current default) ──────────────
    // Custom elements are not flagged unless explicitly configured.
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `<sl-input onkeydown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `<my-text-field onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
    },
    // customElements.allowElements — explicitly ignored even when default is 'check'
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ customElements: { default: 'check', allowElements: ['sl-input'] } }],
    },
    // customElements.default: 'check', but allowElements excludes this element
    {
      code: `<my-button onKeyDown={(e) => { if (e.key === 'Enter') doSomething(); }} />;`,
      options: [{ customElements: { default: 'check', allowElements: ['my-button'] } }],
    },
    // ── jsxComponents option ──────────────────────────────────────────────────────
    // default: 'ignore' — PascalCase components not flagged
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore' } }],
    },
    // jsxComponents.allowComponents — same effect as deprecated top-level allowComponents
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { allowComponents: ['MyInput'] } }],
    },
    // MemberExpression with default: 'ignore'
    {
      code: `<UI.Input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore' } }],
    },
    // default: 'ignore' — component not in disallowComponents is not flagged
    {
      code: `<MyButton onKeyDown={(e) => { if (e.key === 'Enter') doSomething(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore', disallowComponents: ['MyInput'] } }],
    },
    // ── TASK-012: .key / .keyCode / switch on unrelated object — not flagged ───
    // Only MemberExpressions rooted at the event parameter are detected.
    {
      code: `input.addEventListener('keydown', (e) => { if (shortcut.key === 'Enter') doSomething(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (obj.keyCode === 13) doSomething(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { switch(shortcut.key) { case 'Enter': doSomething(); break; } });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.target.key === 'Enter') doSomething(); });`,
    },
  ],

  invalid: [
    // ── non-Enter key checks — same IME race condition ────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Tab') focusNext(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { case 'Escape': close(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `window.onkeydown = (e) => { if (e.key === 'Escape') close(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    {
      code: `input.onkeypress = (e) => { if (e.key === 'Escape') close(); };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `<input onKeyPress={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── addEventListener keydown ──────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // keyup
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    // reversed operand: 'Enter' === e.key
    {
      code: `el.addEventListener('keydown', (e) => { if ('Enter' === e.key) go(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // e.code === 'Enter'
    {
      code: `input.addEventListener('keydown', (e) => { if (e.code === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // legacy keyCode === 13
    {
      code: `input.addEventListener('keydown', (e) => { if (e.keyCode === 13) submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // legacy which == 13 (function keyword)
    {
      code: `input.addEventListener('keydown', function(e) { if (e.which == 13) send(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // function keyword for keyup
    {
      code: `input.addEventListener('keyup', function(e) { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    // async arrow function — ArrowFunctionExpression, still detected
    {
      code: `input.addEventListener('keydown', async (e) => { if (e.key === 'Enter') await submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // nested condition: e.key === 'Enter' && !e.shiftKey
    {
      code: `el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) go(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ternary: e.key === 'Enter' ? submit() : null
    {
      code: `input.addEventListener('keydown', (e) => { e.key === 'Enter' ? submit() : null; });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // loose equality
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key == 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // isComposing referenced but not in an IfStatement test — not a guard
    {
      code: `input.addEventListener('keydown', (e) => { const _c = e.isComposing; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── switch statements ─────────────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.code) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.keyCode) { case 13: submit(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.which) { case 13: submit(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── onkeydown / onkeyup assignment ────────────────────────────────────────
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeydown = function(e) { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeydown = (e) => { if (e.code === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeydown = (e) => { switch(e.key) { case 'Enter': submit(); break; } };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeyup = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    {
      code: `input.onkeyup = (e) => { if (e.code === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    // window.onkeydown assignment with Enter check
    {
      code: `window.onkeydown = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // ── JSX onKeyDown / onKeyUp ───────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.which === 13) submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyUp={(e) => { if (e.keyCode === 13) submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    {
      code: `<input onKeyDown={(e) => { switch(e.key) { case 'Enter': submitForm(); break; } }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyUp={(e) => { switch(e.key) { case 'Enter': submitForm(); break; } }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    // ── keypress — always flagged (deprecated), isComposing does not exempt ───
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { if (e.keyCode === 13) submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // keypress with isComposing — still prohibited
    {
      code: `input.addEventListener('keypress', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    {
      code: `input.onkeypress = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `<input onKeyPress={(e) => { if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── concise arrow function body (expression, not block) ───────────────────
    {
      code: `input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => e.key === 'Enter' && submit());`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // ── onkeyup assignment with switch ────────────────────────────────────────
    {
      code: `input.onkeyup = (e) => { switch(e.key) { case 'Enter': submit(); break; } };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    // onkeydown / onkeyup assignments with legacy keyCode / which
    {
      code: `input.onkeydown = (e) => { if (e.keyCode === 13) submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeydown = (e) => { if (e.which == 13) submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeyup = (e) => { if (e.keyCode === 13) submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    {
      code: `input.onkeyup = (e) => { if (e.which == 13) submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    // onkeypress assignment with e.code and legacy keyCode
    {
      code: `input.onkeypress = (e) => { if (e.code === 'Enter') submit(); };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `input.onkeypress = (e) => { if (e.keyCode === 13) submit(); };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    // ── JSX onKeyDown missing coverage ───────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.code === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.keyCode === 13) submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── JSX onKeyUp missing coverage ─────────────────────────────────────────
    {
      code: `<input onKeyUp={(e) => { if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    {
      code: `<input onKeyUp={(e) => { if (e.code === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    // ── JSX onKeyPress with switch ────────────────────────────────────────────
    {
      code: `<input onKeyPress={(e) => { switch(e.key) { case 'Enter': submitForm(); break; } }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── !== / != early-return pattern without isComposing guard ──────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.keyCode != 13) return; submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key !== 'Enter') return; submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key !== 'Enter') return; submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // onkeydown / onkeyup assignment + !== early-return pattern
    {
      code: `input.onkeydown = (e) => { if (e.key !== 'Enter') return; submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeyup = (e) => { if (e.key !== 'Enter') return; submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    // JSX onKeyDown / onKeyUp + !== early-return pattern
    {
      code: `<input onKeyDown={(e) => { if (e.key !== 'Enter') return; submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyUp={(e) => { if (e.key !== 'Enter') return; submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    // ── ternary isComposing guard — known limitation, not recognised ──────────
    // Only IfStatement tests are scanned; ternary guards are not exempted.
    {
      code: `input.addEventListener('keydown', (e) => { e.isComposing ? null : (e.key === 'Enter' && submit()); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── onkeypress assignment with isComposing guard — still prohibited ───────
    {
      code: `input.onkeypress = (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    // ── JSX onKeyPress with isComposing guard — still prohibited ─────────────
    {
      code: `<input onKeyPress={(e) => { if (e.isComposing) return; if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── keypress + switch ─────────────────────────────────────────────────────
    {
      code: `input.addEventListener('keypress', (e) => { switch(e.key) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { switch(e.code) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { switch(e.keyCode) { case 13: submit(); break; } });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    {
      code: `input.addEventListener('keypress', (e) => { switch(e.which) { case 13: submit(); break; } });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // ── onkeypress assignment + switch ───────────────────────────────────────
    {
      code: `input.onkeypress = (e) => { switch(e.key) { case 'Enter': submit(); break; } };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `input.onkeypress = (e) => { switch(e.code) { case 'Enter': submit(); break; } };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `input.onkeypress = (e) => { switch(e.keyCode) { case 13: submit(); break; } };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `input.onkeypress = (e) => { switch(e.which) { case 13: submit(); break; } };`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    // ── keyup + switch(e.code) ────────────────────────────────────────────────
    {
      code: `input.addEventListener('keyup', (e) => { switch(e.code) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `input.onkeyup = (e) => { switch(e.code) { case 'Enter': submit(); break; } };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    // ── onkeydown / onkeyup concise arrow body ───────────────────────────────
    {
      code: `input.onkeydown = (e) => e.key === 'Enter' && submit();`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeyup = (e) => e.key === 'Enter' && submit();`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    {
      code: `input.onkeypress = (e) => e.key === 'Enter' && submit();`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    // ── JSX concise arrow body ────────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => e.key === 'Enter' && submit()} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyUp={(e) => e.key === 'Enter' && submit()} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    {
      code: `<input onKeyPress={(e) => e.key === 'Enter' && submit()} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── JSX onKeyPress + keyCode / which ─────────────────────────────────────
    {
      code: `<input onKeyPress={(e) => { if (e.keyCode === 13) submit(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    {
      code: `<input onKeyPress={(e) => { if (e.which === 13) submit(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── JSX onKeyPress + switch ───────────────────────────────────────────────
    {
      code: `<input onKeyPress={(e) => { switch(e.code) { case 'Enter': submit(); break; } }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    {
      code: `<input onKeyPress={(e) => { switch(e.keyCode) { case 13: submit(); break; } }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    {
      code: `<input onKeyPress={(e) => { switch(e.which) { case 13: submit(); break; } }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── modifier key — patterns that are NOT safe ────────────────────────────
    // || instead of && — Enter without modifier still triggers
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.ctrlKey) submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // Enter check is the outer if, modifier check is inside — still unsafe
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (e.ctrlKey) submit(); } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // keypress with modifier guard — keypress is always prohibited
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // ── modifier on a non-Enter shortcut must not exempt a bare Enter check ────
    // A non-Enter modifier shortcut co-exists with an unguarded Enter check
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'k') openPalette(); if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'k' && e.ctrlKey) openPalette(); if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // Pattern B variant: modifier outer-if guards only a non-Enter key, Enter is outside
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey) { if (e.key === 'k') openPalette(); } if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.ctrlKey && e.key === 'k') openPalette(); if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `input.onkeydown = (e) => { if (e.ctrlKey && e.key === 'k') openPalette(); if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // modifier-gated Enter must not exempt a separate bare key check
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') submitAlt(); if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') submitAlt(); if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // isComposing guard + non-Enter modifier shortcut + bare Enter → requireKeyCode229 must fire
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.ctrlKey && e.key === 'k') openPalette(); if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.ctrlKey && e.key === 'Enter') submitAlt(); if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // ── guardFunctions — guard not in the list → still flagged ────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keyup" } }],
    },
    // guardFunctions with keypress — keypress is deprecated regardless
    {
      code: `input.addEventListener('keypress', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
      errors: [{ messageId: "keypressProhibited", data: { eventName: "keypress" } }],
    },
    // guard function called outside an IfStatement test — not recognised as a guard
    {
      code: `input.addEventListener('keydown', (e) => { guardIsComposing(e); if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // guard without early exit — if-body must return/throw to stop the handler
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e)) doSomethingElse(); if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"], checkKeyCodeForSafari: false }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // negated guard: !guardFn(e) inverts the guard direction — key handler runs during composition
    {
      code: `input.addEventListener('keydown', (e) => { if (!guardIsComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // compound && condition: guard may not fire for all composing cases (e.shiftKey can prevent early exit)
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e) && !e.shiftKey) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // guard called with non-event arg — rule cannot verify the arg is the event param
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(state)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // isComposing in if-test without early exit — guard is ineffective at runtime
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) console.log("composing"); if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // ── JSX IME-capable elements beyond <input> ───────────────────────────────
    {
      code: `<textarea onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // contentEditable — makes non-input elements IME-capable
    {
      code: `<div contentEditable onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<div contentEditable="true" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<div contenteditable onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // PascalCase component — warned by default (cannot inspect rendered output)
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // allowComponents — unlisted component is still flagged
    {
      code: `<OtherInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['MyInput'] }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── JSXMemberExpression (<Namespace.Component>) — flagged unless listed in allowComponents ─
    {
      code: `<Foo.Bar onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // partial name (only 'Bar') does not match 'Foo.Bar'
    {
      code: `<Foo.Bar onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['Bar'] }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // wrong namespace does not match
    {
      code: `<Foo.Bar onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ allowComponents: ['Baz.Bar'] }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // non-member non-identifier JSX names should not crash; fall back to IME-capable
    {
      code: `<svg:path onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── JSX FunctionExpression (function keyword, not arrow) ─────────────────
    {
      code: `<input onKeyDown={function(e) { if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyPress={function(e) { if (e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onKeyPress' } }],
    },
    // ── isComposing only (default checkKeyCodeForSafari: true) ───────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `input.onkeydown = (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // ── e.nativeEvent.isComposing without keyCode 229 ─────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `input.onkeydown = (e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `<input onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // isComposing with switch
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; switch(e.key) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // checkKeyCodeForSafari: true (explicit) — same as default
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: true }],
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // no isComposing at all → requireImeSafeSubmit (not requireKeyCode229)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: true }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── window.addEventListener ───────────────────────────────────────────────
    {
      code: `window.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `window.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `window.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'keypress' } }],
    },
    // ── lowercase JSX event attributes — missing isComposing guard ────────────
    {
      code: `<input onkeydown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `<input onkeyup={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    {
      code: `<input onkeypress={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    {
      code: `<textarea onkeydown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // lowercase onkeydown with isComposing only → requireKeyCode229
    {
      code: `<input onkeydown={(e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // onkeypress with isComposing guard — still prohibited
    {
      code: `<input onkeypress={(e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'keypressProhibited', data: { eventName: 'onkeypress' } }],
    },
    // ── customElements option ─────────────────────────────────────────────────
    // default: 'check' — all custom elements checked
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ customElements: { default: 'check' } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<my-text-field onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ customElements: { default: 'check' } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // default: 'check' with lowercase event attribute
    {
      code: `<sl-input onkeydown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ customElements: { default: 'check' } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // disallowElements — explicitly flag a specific element (even when default is 'ignore')
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ customElements: { disallowElements: ['sl-input'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // default: 'check', allowElements excludes another element — this one is still flagged
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ customElements: { default: 'check', allowElements: ['my-button'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── jsxComponents option ──────────────────────────────────────────────────
    // disallowComponents — explicitly flag a named component
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { disallowComponents: ['MyInput'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // default: 'ignore' but disallowComponents overrides for named component
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore', disallowComponents: ['MyInput'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // MemberExpression with disallowComponents
    {
      code: `<UI.Input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { disallowComponents: ['UI.Input'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // default: 'ignore' but MemberExpression in disallowComponents is still flagged
    {
      code: `<UI.Input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore', disallowComponents: ['UI.Input'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── TASK-013: isComposing on unrelated object not accepted as guard ─────────
    {
      code: `input.addEventListener('keydown', (e) => { if (state.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── isComposing guard scope — key checks outside the guarded IfStatement ────
    // wrapping pattern + unguarded key check outside → still flagged
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) { if (e.key === 'Enter') submit(); } if (e.key === 'Escape') close(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // inline pattern + unguarded key check outside → still flagged
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.key === 'Enter') submit(); if (e.key === 'Escape') close(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── isComposing direction — positive or non-blocking guard ───────────────────
    // inline: e.isComposing && e.key runs the key check WHEN composing → unsafe
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing && e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // wrapping: if (e.isComposing) { key check } runs the key check WHEN composing → unsafe
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) { if (e.key === 'Enter') submit(); } });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // inline OR: !e.isComposing || e.key can still be true when composing → unsafe
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing || e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── reversed pure guard: exits when NOT composing, so key check runs when composing ─
    // simple reversed guard
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // compound reversed guard: AND with negated isComposing also does not guarantee exit when composing
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && ready) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── nested pattern: guard must be FIRST statement in the key-check if-body ──
    // action before isComposing guard → action runs while composing
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { submit(); if (e.isComposing) return; } });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // action before guardFunctions guard → action runs while composing
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { submit(); if (guardIsComposing(e)) return; } });`,
      options: [{ checkKeyCodeForSafari: false, guardFunctions: ['guardIsComposing'] }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── guardFunctions — multiple args not recognized as the event param guard ──
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e, state)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ["guardIsComposing"] }],
      errors: [{ messageId: "requireImeSafeSubmit", data: { eventName: "keydown" } }],
    },
    // ── TASK-013: modifier key on unrelated object does not exempt Enter check ──
    {
      code: `input.addEventListener('keydown', (e) => { if (shortcut.ctrlKey && e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `<input onKeyDown={(e) => { if (shortcut.ctrlKey && e.key === 'Enter') submitForm(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.target.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e = window.event) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
  ],
});

console.log('All tests passed!');
