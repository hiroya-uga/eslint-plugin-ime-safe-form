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
    // ── keydown / keyup without Enter check — not a submit pattern ───────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });`,
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Escape') close(); });`,
    },
    // switch on key without Enter case
    {
      code: `input.addEventListener('keydown', (e) => { switch(e.key) { case 'Escape': close(); break; } });`,
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
    // ── window.onkeydown — no Enter check ────────────────────────────────────
    {
      code: `window.onkeydown = (e) => { if (e.key === 'Escape') close(); };`,
    },
    // ── keypress without Enter check ─────────────────────────────────────────
    {
      code: `input.addEventListener('keypress', (e) => { if (e.key === 'Escape') close(); });`,
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
    // ── onkeypress assignment without Enter check ────────────────────────────
    {
      code: `input.onkeypress = (e) => { if (e.key === 'Escape') close(); };`,
    },
    // ── isComposing guard with switch statement (keyup) ───────────────────────
    {
      code: `input.addEventListener('keyup', (e) => { if (e.isComposing) return; switch(e.key) { case 'Enter': submit(); break; } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── JSX onKeyPress without Enter check ───────────────────────────────────
    {
      code: `<input onKeyPress={(e) => { if (e.key === 'Escape') close(); }} />;`,
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
    // ── Known limitation: isComposing in if-test without return ───────────────
    // The rule accepts any IfStatement whose test mentions isComposing.
    // If the if-body does not return/throw, the guard is ineffective at runtime,
    // but detecting that requires data-flow analysis beyond this rule's scope.
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) console.log("composing"); if (e.key === 'Enter') submit(); });`,
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
  ],

  invalid: [
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
      code: `input.onkeypress = (e) => { switch(e.keyCode) { case 13: submit(); break; } };`,
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
  ],
});

console.log('All tests passed!');
