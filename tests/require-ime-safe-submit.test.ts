import { RuleTester } from 'eslint';
import rule from '../src/rules/require-ime-safe-submit';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('require-ime-safe-submit', rule, {
  valid: [
    // ── addEventListener: isComposing + Safari guard ────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
    },
    // isComposing guard only (checkKeyCodeForSafari: false)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // Non-Enter key checks are NOT flagged (Enter-specific rule)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') next(); });`,
    },
    // form submit event is fine
    {
      code: `form.addEventListener('submit', () => { submit(); });`,
    },
    // ── onkeydown assignment ────────────────────────────────────────────────
    {
      code: `input.onkeydown = (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); };`,
    },
    // React synthetic event — nativeEvent guards still work
    {
      code: `input.addEventListener('keydown', (e) => { if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return; if (e.nativeEvent.key === 'Enter') submit(); });`,
    },
    // Enter variants: e.code / e.which and switch(e.code)
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.code === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.which === 13) submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.isComposing) return; switch(e.code) { case 'Enter': submit(); break; } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // Non-Enter via onkeydown — not flagged
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Escape') close(); };`,
    },
    // ── JSX ────────────────────────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
    },
    {
      code: `<input onkeydown={(e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') submit(); }} />;`,
    },
    // Non-Enter JSX — not flagged
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Escape') close(); }} />;`,
    },
    // ── guardFunctions option ───────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (guardComposing(e)) return; if (e.key === 'Enter') submit(); });`,
      options: [{ guardFunctions: ['guardComposing'], checkKeyCodeForSafari: false }],
    },
    // ── !== 'Enter' early-return with isComposing guard ─────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing || e.keyCode === 229) return; if (e.key !== 'Enter') return; submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key !== 'Enter') return; submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key != 'Enter') return; submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── modifier key guard — IME cannot be composing while a modifier is held ──
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey && e.metaKey)) submit(); });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.ctrlKey) { if (e.key === 'Enter') submit(); } });`,
    },
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submit(); }} />;`,
    },
    // ── throw as early exit — accepted same as return ────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) throw new Error(); if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── isComposing guard nested inside the key check body ────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (e.isComposing) return; submit(); } });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── separate if guards ───────────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.keyCode === 229) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: false }],
    },
    // ── !e.isComposing && e.keyCode !== 229 — De Morgan equivalent of the Safari guard ──
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.keyCode !== 229) { if (e.key === 'Enter') submit(); } });`,
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.keyCode !== 229 && e.key === 'Enter') submit(); });`,
    },
  ],
  invalid: [
    // ── addEventListener ────────────────────────────────────────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `window.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { switch(e.code) { case 'Enter': submit(); break; } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.which === 13) submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // Missing Safari keyCode guard
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      options: [{ checkKeyCodeForSafari: true }],
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.nativeEvent.isComposing) return; if (e.nativeEvent.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireKeyCode229' }],
    },
    // ── onkeydown assignment ────────────────────────────────────────────────
    {
      code: `input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // ── JSX ────────────────────────────────────────────────────────────────
    {
      code: `<input onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onKeyDown' } }],
    },
    {
      code: `<input onkeydown={(e) => { if (e.key === 'Enter') submit(); }} />;`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'onkeydown' } }],
    },
    // ── !== 'Enter' early-return without isComposing guard ──────────────────
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keyup', (e) => { if (e.key !== 'Enter') return; submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keyup' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key != 'Enter') return; submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── OR with modifier is NOT a guard (plain Enter branch still fires without modifier) ──
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.ctrlKey) submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    {
      code: `input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // ── isComposing in wrong direction — unsafe ───────────────────────────────
    // bare e.isComposing guard runs the key check WHEN composing
    {
      code: `input.addEventListener('keydown', (e) => { if (e.isComposing) { if (e.key === 'Enter') submit(); } });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // reversed pure guard — exits when NOT composing, key check runs while composing
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
    // De Morgan reversed guard — same problem: exits when NOT composing
    {
      code: `input.addEventListener('keydown', (e) => { if (!e.isComposing && e.keyCode !== 229) return; if (e.key === 'Enter') submit(); });`,
      errors: [{ messageId: 'requireImeSafeSubmit', data: { eventName: 'keydown' } }],
    },
  ],
});

console.log('All tests passed!');
