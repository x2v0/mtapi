// MTAPI_ESLINT_STRICT: явная проверка no-undef (не полагается на .eslintrc)
// Ловит ReferenceError вида "h is not defined" на этапе линта.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

let ESLint;
try {
  ESLint = require('eslint').ESLint;
} catch (e) {
  test('eslint strict: not installed', () => {});
  process.exit(0);
}

const APP_JS = path.resolve(__dirname, '../gocore/cmd/mtapi-server/app.js');

test('eslint strict: no-undef catches undefined vars (h regression)', async () => {
  // ESLint v9: overrideConfigFile: true вместо useEslintrc: false
  const opts = {
    overrideConfigFile: true,
    overrideConfig: {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
        globals: {
          window: 'readonly', document: 'readonly', navigator: 'readonly',
          localStorage: 'readonly', fetch: 'readonly', console: 'readonly',
          setTimeout: 'readonly', clearTimeout: 'readonly',
          setInterval: 'readonly', clearInterval: 'readonly',
          AbortController: 'readonly', performance: 'readonly',
          module: 'readonly', require: 'readonly', process: 'readonly',
          TOKEN: 'readonly', Android: 'readonly',
          URL: 'readonly', Blob: 'readonly', FileReader: 'readonly',
          XMLHttpRequest: 'readonly',
        },
      },
      rules: { 'no-undef': 'error' },
    },
  };
  const eslint = new ESLint(opts);
  const results = await eslint.lintFiles([APP_JS]);
  const undefs = (results[0].messages || []).filter(function (m) {
    return m.ruleId === 'no-undef';
  });
  if (undefs.length > 0) {
    const msg = undefs.map(function (m) {
      return '  L' + m.line + ':' + m.column + ' ' + m.message;
    }).join('\n');
    assert.fail('no-undef errors:\n' + msg);
  }
});
