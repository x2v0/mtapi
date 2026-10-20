// test/mtapi-acorn.test.js — acorn parse app.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const APP_JS = path.resolve(process.env.HOME, 'mtapi/gocore/cmd/mtapi-server/app.js');

test('acorn: app.js parses without errors', () => {
  const src = fs.readFileSync(APP_JS, 'utf8');
  assert.doesNotThrow(() => {
    acorn.parse(src, { ecmaVersion: 2020, sourceType: 'script' });
  }, 'app.js should parse');
});

test('acorn: has function declarations', () => {
  const src = fs.readFileSync(APP_JS, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2020 });
  const fnNames = [];
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      fnNames.push(node.id.name);
    }
  }
  assert.ok(fnNames.includes('render'), 'render');
  assert.ok(fnNames.includes('renderData'), 'renderData');
  assert.ok(fnNames.includes('renderObj'), 'renderObj');
  assert.ok(fnNames.includes('renderCell'), 'renderCell');
  assert.ok(fnNames.includes('makeCard'), 'makeCard');
  assert.ok(fnNames.includes('esc'), 'esc');
  assert.ok(fnNames.includes('isStatic'), 'isStatic');
});
