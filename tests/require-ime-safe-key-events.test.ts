import { RuleTester } from 'eslint';
import rule = require('../src/rules/require-ime-safe-key-events');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('require-ime-safe-key-events', rule, {
  valid: [
    // ── Enter key — NOT flagged by this rule (require-ime-safe-submit handles Enter) ──
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };`,
    },
    // ── form submit event ────────────────────────────────────────────────────
    {
      code: `form.addEventListener('submit', (e) => { e.preventDefault(); send(); });`,
    },
    {
      code: `<form onSubmit={(e) => { e.preventDefault(); send(); }} />`,
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
    // isComposing guard only
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Escape') close(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; switch(e.key) { case 'Escape': close(); break; } });`,
    },
    {
      code: `input.onkeydown = (e) => { if (e.isComposing) return; if (e.key === 'Escape') close(); };`,
    },
    {
      code: `input.onkeyup = (e) => { if (e.isComposing) return; if (e.key === 'Tab') focusNext(); };`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing) return; if (e.key === 'Escape') close(); }} />;`,
    },
    // checkKeyCodeForSafari option — has no effect on this rule (Enter excluded), accepted without error
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Escape') close(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── e.nativeEvent.isComposing ─────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Escape') close(); });`,
    },
    // ── throw as early exit — accepted same as return ────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) throw new Error(); if (e.key === 'Escape') close(); });`,
    },
    // ── !== early-return pattern with isComposing guard ───────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key !== 'Escape') return; close(); });`,
    },
    // ── isComposing guard nested inside the key check body ────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (e.isComposing) return; close(); } });`,
    },
    // ── isComposing in logical AND: !e.isComposing && e.key === 'Escape' ──────
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.key === 'Escape') close(); });`,
    },
    // ── isComposing guard in outer if block ──────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) { if (e.key === 'Escape') close(); } });`,
    },
    // ── separate if guards ───────────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.keyCode === 229) return; if (e.key === 'Escape') close(); });`,
    },
    // ── window.addEventListener ───────────────────────────────────────────────
    {
      code: `window.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Escape') close(); });`,
    },
    {
      code: `window.onkeydown = (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Escape') close(); };`,
    },
    // ── click event — unrelated ───────────────────────────────────────────────
    {
      code: `btn.addEventListener('click', () => submit());`,
    },
    // ── Enter check inside nested function — out of scope ────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { setTimeout(() => { if (e.key === 'Escape') close(); }, 0); });`,
    },
    // ── Named function reference — cannot statically analyze external body ───
    {
      code: `input.addEventListener('keydown', handleKeydown);`,
    },
    {
      code: `input.addEventListener('keyup', handleKeyup);`,
    },
    {
      code: `input.onkeydown = handleKeydown;`,
    },
    {
      code: `<input onKeyDown={handleKeydown} />;`,
    },
    // ── Known limitation: destructured event parameter — not detected ─────────
    {
      code: `input.addEventListener('keydown', ({ key }) => { if (key === 'Escape') close(); });`,
    },
    // ── modifier key guard — IME cannot compose while a modifier is held ─────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'k' && e.ctrlKey) openPalette(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'k') openPalette(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.shiftKey) closeAll(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey) { if (e.key === 'k') openPalette(); } });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Escape' && e.ctrlKey) closeAll(); }} />;`,
    },
    // ── camelCase DOM assignment (onKeyDown, onKeyUp) — not a valid DOM API ───
    {
      code: `input.onKeyDown = (e) => { if (e.key === 'Escape') close(); };`,
    },
    {
      code: `input.onKeyUp = (e) => { if (e.key === 'Tab') focusNext(); };`,
    },
    // ── lowercase JSX event attributes with isComposing guard ────────────────
    {
      code: `<input onkeydown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Escape') close(); }} />;`,
    },
    {
      code: `<input onkeyup={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Tab') focusNext(); }} />;`,
    },
    // non-IME-capable element with lowercase event — never flagged
    {
      code: `<div onkeydown={(e) => { if (e.key === 'Escape') someAction(); }} />;`,
    },
    // ── JSX non-input HTML elements — not IME-capable ───────────────────────
    {
      code: `<div onKeyDown={(e) => { if (e.key === 'Escape') someAction(); }} />;`,
    },
    {
      code: `<button onKeyDown={(e) => { if (e.key === 'Escape') someAction(); }} />;`,
    },
    {
      code: `<span onKeyDown={(e) => { if (e.key === 'Escape') someAction(); }} />;`,
    },
    // contentEditable="false" — explicitly not editable
    {
      code: `<div contentEditable="false" onKeyDown={(e) => { if (e.key === 'Escape') someAction(); }} />;`,
    },
    {
      code: `<div contentEditable={false} onKeyDown={(e) => { if (e.key === 'Escape') someAction(); }} />;`,
    },
    // ── allowComponents option ────────────────────────────────────────────────
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ allowComponents: ['MyInput'] }],
    },
    {
      code: `<MyInput onKeyUp={(e) => { if (e.key === 'Tab') focusNext(); }} />;`,
      options: [{ allowComponents: ['MyInput'] }],
    },
    // ── allowComponents with dot-notation ────────────────────────────────────
    {
      code: `<UI.Input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ allowComponents: ['UI.Input'] }],
    },
    // ── guardFunctions option ─────────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Escape') close(); });`,
      options: [{ guardFunctions: ['guardIsComposing'] }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Tab') focusNext(); });`,
      options: [{ guardFunctions: ['guardIsComposing'] }],
    },
    {
      code: `<input onKeyDown={(e) => { if (guardIsComposing(e)) return; if (e.key === 'Escape') close(); }} />;`,
      options: [{ guardFunctions: ['guardIsComposing'] }],
    },
    // ── customElements option — default: 'ignore' ─────────────────────────────
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
    },
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ customElements: { default: 'check', allowElements: ['sl-input'] } }],
    },
    {
      code: `<my-button onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ customElements: { default: 'check', allowElements: ['my-button'] } }],
    },
    // ── jsxComponents option ──────────────────────────────────────────────────
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore' } }],
    },
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ jsxComponents: { allowComponents: ['MyInput'] } }],
    },
    {
      code: `<MyButton onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ jsxComponents: { default: 'ignore', disallowComponents: ['MyInput'] } }],
    },
    // ── mixed switch (Enter + non-Enter) with isComposing guard ─────────────
    // guard covers all cases including the non-Enter ones
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; switch(e.key) { case 'Enter': submit(); break; case 'Escape': close(); break; } });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; switch(e.key) { case 'Enter': submit(); break; case 'Escape': close(); break; } });`,
    },
    // mixed switch with default — guard covers the non-Enter default path too
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; switch(e.key) { case 'Enter': submit(); break; default: close(); } });`,
    },
    // switch with only an Enter case — not flagged by this rule (require-ime-safe-submit handles it)
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { case 'Enter': submit(); break; } });`,
    },
    // ── unrelated object .key / .keyCode — not flagged ───────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (shortcut.key === 'Escape') doSomething(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (obj.keyCode === 27) doSomething(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.target.key === 'Escape') doSomething(); });`,
    },
    // ── !e.isComposing && e.keyCode !== 229 — De Morgan equivalent of the Safari guard ──
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.keyCode !== 229) { if (e.key === 'Escape') close(); } });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.keyCode !== 229 && e.key === 'Escape') close(); });`,
    },
    // ── default parameter value — e still detected as the event param ────────
    {
      code: `input.addEventListener('keydown', (e = window.event) => { if (e.isComposing) return; if (e.key === 'Escape') close(); });`,
    },
  ],

  invalid: [
    // ── non-Enter key checks without isComposing guard ────────────────────────
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
    // ── onkeydown / onkeyup assignment ────────────────────────────────────────
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Escape') close(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    {
      code: `input.onkeyup = (e) => { if (e.key === 'Tab') focusNext(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeyup' } }],
    },
    // ── JSX non-Enter key checks ──────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onKeyUp={(e) => { if (e.key === 'Tab') focusNext(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyUp' } }],
    },
    {
      code: `<textarea onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // contentEditable — makes non-input elements IME-capable
    {
      code: `<div contentEditable onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // PascalCase component — warned by default
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── isComposing in wrong direction — unsafe ───────────────────────────────
    // bare e.isComposing guard runs the key check WHEN composing
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) { if (e.key === 'Escape') close(); } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // reversed pure guard — exits when NOT composing, key check runs while composing
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) return; if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── guardFunctions — guard not in option list → still flagged ────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (guardIsComposing(e)) return; if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── customElements: 'check' — custom element non-Enter key flagged ─────────
    {
      code: `<sl-input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ customElements: { default: 'check' } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── jsxComponents disallowComponents ─────────────────────────────────────
    {
      code: `<MyInput onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
      options: [{ jsxComponents: { disallowComponents: ['MyInput'] } }],
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // ── mixed switch (Enter + non-Enter) without isComposing guard ───────────
    // The non-Enter case (Escape) is unguarded — this rule must flag it
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { case 'Enter': submit(); break; case 'Escape': close(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `<input onKeyDown={(e) => { switch(e.key) { case 'Enter': submit(); break; case 'Escape': close(); break; } }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    // default branch is also a non-Enter path and must be guarded
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { case 'Enter': submit(); break; default: close(); } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { default: close(); } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── modifier on non-Enter shortcut must not exempt an unguarded non-Enter check ──
    // Modifier guards Enter; Escape has no guard — Escape must still be flagged
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') submitAlt(); if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── regression: isComposing wraps Enter but Escape is outside the guard ───
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) { if (e.key === 'Enter') submit(); } if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // inline isComposing covers Enter; Escape is outside
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.key === 'Enter') submit(); if (e.key === 'Escape') close(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
  ],
});

console.log('All tests passed!');
