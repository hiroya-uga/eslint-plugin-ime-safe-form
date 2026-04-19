import type { ESLint, Linter } from 'eslint';
import requireImeSafeSubmit from './rules/require-ime-safe-submit';
import { version } from '../package.json';

const plugin = {
  meta: {
    name: 'eslint-plugin-ime-safe-form',
    version,
  },
  rules: {
    'require-ime-safe-submit': requireImeSafeSubmit,
  },
  configs: {} as Record<string, Linter.Config>,
} satisfies ESLint.Plugin;

// ESLint 9 flat config
plugin.configs['recommended'] = {
  plugins: { 'ime-safe-form': plugin },
  rules: {
    'ime-safe-form/require-ime-safe-submit': 'warn',
  },
};

// ESLint 8 eslintrc-style config.
// The shape differs from Linter.Config (flat config), so we use a cast.
(plugin.configs as Record<string, unknown>)['recommended:legacy'] = {
  plugins: ['ime-safe-form'],
  rules: {
    'ime-safe-form/require-ime-safe-submit': 'warn',
  },
};

export = plugin;
