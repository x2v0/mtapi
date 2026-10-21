// mtapi-jsdom.test.js — тесты app.js через jsdom
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const APP_JS = path.resolve(process.env.HOME, 'mtapi/gocore/cmd/mtapi-server/app.js');
const INDEX_HTML = path.resolve(process.env.HOME, 'mtapi/gocore/cmd/mtapi-server/index.html');

let app;
try {
  app = require(APP_JS);
} catch (e) {
  console.error('require(APP_JS) failed:', e.message);
}

// ═══════════════════════════════════════════════════════
// 1. app.js exists + requires
// ═══════════════════════════════════════════════════════
test('app.js exists', () => {
  assert.ok(fs.existsSync(APP_JS), 'app.js not found at ' + APP_JS);
});

test('app.js requires without error', () => {
  assert.ok(app, 'app.js did not load (require failed)');
  assert.strictEqual(typeof app.renderCell, 'function', 'renderCell not exported');
});

// ═══════════════════════════════════════════════════════
// 2. renderCell: nested object → details.sub
// ═══════════════════════════════════════════════════════
test('renderCell: nested object → details.sub', () => {
  assert.ok(app, 'app not loaded');
  const out = app.renderCell({x: 1}, 0);
  assert.ok(out.includes('<details class="sub"'),
    'nested object should be <details class="sub">; got: ' + out.slice(0, 100));
  assert.ok(out.includes('<summary>'), 'should have <summary>');
});

// ═══════════════════════════════════════════════════════
// 3. renderCell: scalar array → code
// ═══════════════════════════════════════════════════════
test('renderCell: scalar array → code', () => {
  assert.ok(app, 'app not loaded');
  const out = app.renderCell([1, 2, 3], 0);
  assert.ok(out.includes('<code>'),
    'scalar array should be <code>; got: ' + out.slice(0, 100));
});

// ═══════════════════════════════════════════════════════
// 4. renderCell: null → v-null
// ═══════════════════════════════════════════════════════
test('renderCell: null → v-null', () => {
  assert.ok(app, 'app not loaded');
  const out = app.renderCell(null, 0);
  assert.ok(out.includes('v-null'), 'null should be v-null; got: ' + out);
});

// ═══════════════════════════════════════════════════════
// 5. renderCell: number → v-num
// ═══════════════════════════════════════════════════════
test('renderCell: number → v-num', () => {
  assert.ok(app, 'app not loaded');
  const out = app.renderCell(42, 0);
  assert.ok(out.includes('v-num'), '42 should be v-num; got: ' + out);
});

// ═══════════════════════════════════════════════════════
// 6. renderCell: array of objects → mini table
// ═══════════════════════════════════════════════════════
test('renderCell: array of objects → details.sub', () => {
  assert.ok(app, 'app not loaded');
  const out = app.renderCell([{a: 1}, {a: 2}], 0);
  assert.ok(out.includes('<details class="sub"'),
    'array of objects should be <details class="sub">; got: ' + out.slice(0, 100));
});

// ═══════════════════════════════════════════════════════
// 7. jsdom: renderData → таблица
// ═══════════════════════════════════════════════════════
test('jsdom: renderData({a:1}) → DOM table', () => {
  assert.ok(app, 'app not loaded');
  const html = app.renderData({a: 1});
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const doc = dom.window.document;
  const table = doc.querySelector('table');
  assert.ok(table, 'should have <table>');
  assert.ok(table.classList.contains('kv'), 'should be kv');
  assert.ok(table.querySelector('th'), 'should have <th>');
});

// ═══════════════════════════════════════════════════════
// 8. jsdom: renderData([{x:1},{x:2}]) → 2 rows
// ═══════════════════════════════════════════════════════
test('jsdom: renderData([{x:1},{x:2}]) → 2 rows', () => {
  assert.ok(app, 'app not loaded');
  const html = app.renderData([{x: 1}, {x: 2}]);
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const rows = dom.window.document.querySelectorAll('tbody tr');
  assert.strictEqual(rows.length, 2, `expected 2 rows, got ${rows.length}`);
});

// ═══════════════════════════════════════════════════════
// 9. jsdom: renderObj({nested:{}}) → details.sub
// ═══════════════════════════════════════════════════════
test('jsdom: renderObj({nested:{}}) → details.sub', () => {
  assert.ok(app, 'app not loaded');
  const html = app.renderObj({nested: {a: 1}}, 0);
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const details = dom.window.document.querySelectorAll('details.sub');
  assert.ok(details.length >= 1, 'should have details.sub');
  assert.ok(details[0].querySelector('summary'), 'should have summary');
});

// ═══════════════════════════════════════════════════════
// 10. jsdom: renderObj nested array → details.sub
// ═══════════════════════════════════════════════════════
test('jsdom: renderObj nested array → details.sub', () => {
  assert.ok(app, 'app not loaded');
  const html = app.renderObj({items: [{a: 1}, {a: 2}]}, 0);
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const details = dom.window.document.querySelectorAll('details.sub');
  assert.ok(details.length >= 1, 'should have details.sub');
});

// ═══════════════════════════════════════════════════════
// 11. jsdom: esc prevents injection
// ═══════════════════════════════════════════════════════
test('jsdom: esc prevents injection', () => {
  assert.ok(app, 'app not loaded');
  const html = app.esc('<script>alert(1)</script>');
  const dom = new JSDOM(`<div>${html}</div>`);
  assert.strictEqual(dom.window.document.querySelector('script'), null,
    'should not create <script>');
});
