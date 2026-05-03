import type { ESLint, Linter } from 'eslint';
import noKeypressEvent from './rules/no-keypress-event';
import requireImeSafeKeyEvents from './rules/require-ime-safe-key-events';
import requireImeSafeSubmit from './rules/require-ime-safe-submit';
import { VERSION } from './version';

const plugin = {
  meta: {
    name: 'eslint-plugin-ime-safe-form',
    version: VERSION,
  },
  rules: {
    'no-keypress-event': noKeypressEvent,
    'require-ime-safe-key-events': requireImeSafeKeyEvents,
    'require-ime-safe-submit': requireImeSafeSubmit,
  },
  configs: {} as Record<string, Linter.Config>,
} satisfies ESLint.Plugin;

// ESLint 9 flat config
plugin.configs['recommended'] = {
  plugins: { 'ime-safe-form': plugin },
  rules: {
    'ime-safe-form/no-keypress-event': 'warn',
    'ime-safe-form/require-ime-safe-submit': 'warn',
    'ime-safe-form/require-ime-safe-key-events': 'warn',
  },
};

// ESLint 8 eslintrc-style config.
// The shape differs from Linter.Config (flat config), so we use a cast.
(plugin.configs as Record<string, unknown>)['recommended:legacy'] = {
  plugins: ['ime-safe-form'],
  rules: {
    'ime-safe-form/no-keypress-event': 'warn',
    'ime-safe-form/require-ime-safe-submit': 'warn',
    'ime-safe-form/require-ime-safe-key-events': 'warn',
  },
};

export = plugin;
