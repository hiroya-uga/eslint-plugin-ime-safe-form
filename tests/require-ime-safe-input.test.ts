import { RuleTester } from 'eslint';
import rule from '../src/rules/require-ime-safe-input';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('require-ime-safe-input', rule, {
  valid: [
    // isComposing guard before value write
    {
      code: `input.addEventListener('input', (event) => {
        if (event.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // throw as early exit
    {
      code: `input.addEventListener('input', (event) => {
        if (event.isComposing) throw new Error();
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // nativeEvent.isComposing guard (React)
    {
      code: `input.addEventListener('input', (event) => {
        if (event.nativeEvent.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // wrapping pattern: if (!event.isComposing) { value write }
    {
      code: `input.addEventListener('input', (event) => {
        if (!event.isComposing) {
          event.target.value = event.target.value.replace(/[^0-9]/g, '');
        }
      });`,
    },
    // if (event.isComposing) { other } else { value write } — write in else is safe (runs when not composing)
    {
      code: `input.addEventListener('input', (event) => {
        if (event.isComposing) {
          doSomething();
        } else {
          event.target.value = event.target.value.replace(/[^0-9]/g, '');
        }
      });`,
    },
    // read-only — no write to target.value
    {
      code: `input.addEventListener('input', (event) => {
        const filtered = event.target.value.replace(/[^0-9]/g, '');
        console.log(filtered);
      });`,
    },
    // blur event — safe timing
    {
      code: `input.addEventListener('blur', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // compositionend event — safe timing
    {
      code: `input.addEventListener('compositionend', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // change event — fires after blur, safe timing
    {
      code: `input.addEventListener('change', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // keydown event — different rule scope
    {
      code: `input.addEventListener('keydown', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // named function reference — not analyzed (handler body is not statically available)
    {
      code: `input.addEventListener('input', handleInput);`,
    },
    // value write inside a nested function — not flagged (crosses function boundary)
    {
      code: `input.addEventListener('input', (event) => {
        setTimeout(() => { event.target.value = ''; }, 0);
      });`,
    },
    // currentTarget with guard
    {
      code: `input.addEventListener('input', (event) => {
        if (event.isComposing) return;
        event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '');
      });`,
    },
    // oninput assignment with guard
    {
      code: `input.oninput = (event) => {
        if (event.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      };`,
    },
    // JSX onInput with guard
    {
      code: `<input onInput={(event) => {
        if (event.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
    },
    // JSX onChange with guard
    {
      code: `<input onChange={(event) => {
        if (event.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
    },
    // JSX onBeforeInput with guard
    {
      code: `<input onBeforeInput={(event) => {
        if (event.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
    },
    // isComposing guard in nested block before write
    {
      code: `input.addEventListener('input', (event) => {
        if (someCondition) {
          if (event.isComposing) return;
          event.target.value = event.target.value.replace(/[^0-9]/g, '');
        }
      });`,
    },
    // FunctionExpression handler with guard
    {
      code: `input.addEventListener('input', function(event) {
        if (event.isComposing) return;
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // destructured param: { target, isComposing } with early-exit guard
    {
      code: `input.addEventListener('input', ({ target, isComposing }) => {
        if (isComposing) return;
        target.value = target.value.replace(/[^0-9]/g, '');
      });`,
    },
    // destructured param: wrapping pattern if (!isComposing) { write }
    {
      code: `input.addEventListener('input', ({ target, isComposing }) => {
        if (!isComposing) {
          target.value = target.value.replace(/[^0-9]/g, '');
        }
      });`,
    },
    // destructured param: renamed target with guard
    {
      code: `input.addEventListener('input', ({ target: el, isComposing }) => {
        if (isComposing) return;
        el.value = el.value.replace(/[^0-9]/g, '');
      });`,
    },
    // destructured param: no target binding — no relevant write possible
    {
      code: `input.addEventListener('input', ({ key }) => {
        console.log(key);
      });`,
    },
    // JSX onChange on <select> — not IME-capable, not flagged
    {
      code: `<select onChange={(event) => {
        event.target.value = 'x';
      }} />;`,
    },
    // JSX onInput on <div> without contentEditable — not IME-capable
    {
      code: `<div onInput={(event) => {
        event.target.value = 'x';
      }} />;`,
    },
  ],

  invalid: [
    // basic input event value rewrite
    {
      code: `input.addEventListener('input', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // beforeinput event
    {
      code: `input.addEventListener('beforeinput', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // currentTarget.value write
    {
      code: `input.addEventListener('input', (event) => {
        event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // oninput assignment
    {
      code: `input.oninput = (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      };`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // JSX onInput
    {
      code: `<input onInput={(event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // JSX onChange (React maps this to native input event)
    {
      code: `<input onChange={(event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // JSX onBeforeInput without guard
    {
      code: `<input onBeforeInput={(event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // wrong guard direction: if (e.isComposing) { value write } runs WHILE composing
    {
      code: `input.addEventListener('input', (event) => {
        if (event.isComposing) {
          event.target.value = event.target.value.replace(/[^0-9]/g, '');
        }
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // guard comes AFTER the write — not protected
    {
      code: `input.addEventListener('input', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
        if (event.isComposing) return;
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // value write in else branch of !isComposing — runs while composing
    {
      code: `input.addEventListener('input', (event) => {
        if (!event.isComposing) {
          doSomething();
        } else {
          event.target.value = event.target.value.replace(/[^0-9]/g, '');
        }
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // += operator is also a write
    {
      code: `input.addEventListener('input', (event) => {
        event.target.value += '!';
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // FunctionExpression handler without guard
    {
      code: `input.addEventListener('input', function(event) {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // destructured param: { target } with no guard
    {
      code: `input.addEventListener('input', ({ target }) => {
        target.value = target.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // destructured param: { target: el } renamed, no guard
    {
      code: `input.addEventListener('input', ({ target: el }) => {
        el.value = el.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // destructured param: isComposing bound but not used as guard
    {
      code: `input.addEventListener('input', ({ target, isComposing }) => {
        console.log(isComposing);
        target.value = target.value.replace(/[^0-9]/g, '');
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // destructured param: guard comes after write
    {
      code: `input.addEventListener('input', ({ target, isComposing }) => {
        target.value = target.value.replace(/[^0-9]/g, '');
        if (isComposing) return;
      });`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
    // JSX onInput on <textarea> — IME-capable
    {
      code: `<textarea onInput={(event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
      }} />;`,
      errors: [{ messageId: 'requireImeSafeInput' }],
    },
  ],
});
