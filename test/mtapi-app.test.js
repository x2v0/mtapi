// test/mtapi-app.test.js — тесты app.js (из mtapi) через require()
// Использует jsdom, acorn, eslint, встроенные в dash/test

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Путь к app.js (из mtapi)
const APP_JS = path.resolve(
  process.env.HOME,
  'mtapi/gocore/cmd/mtapi-server/app.js'
);
const STYLE_CSS = path.resolve(
  process.env.HOME,
  'mtapi/gocore/cmd/mtapi-server/style.css'
);
const INDEX_HTML = path.resolve(
  process.env.HOME,
  'mtapi/gocore/cmd/mtapi-server/index.html'
);

// ═══════════════════════════════════════════════════════
// require(app.js)
// ═══════════════════════════════════════════════════════
let app;
try {
  app = require(APP_JS);
} catch (e) {
  console.error('✗ require(app.js) failed:', e.message);
  console.error(e.stack);
}

test('app.js exists', () => {
  assert.ok(fs.existsSync(APP_JS), 'app.js not found at ' + APP_JS);
});

test('app.js requires without error', () => {
  assert.ok(app, 'app.js did not load');
});

test('exports: render, renderData, renderObj, renderCell, makeCard, run, call, esc', () => {
  assert.ok(app);
  assert.strictEqual(typeof app.render, 'function');
  assert.strictEqual(typeof app.renderData, 'function');
  assert.strictEqual(typeof app.renderObj, 'function');
  assert.strictEqual(typeof app.renderCell, 'function');
  assert.strictEqual(typeof app.makeCard, 'function');
  assert.strictEqual(typeof app.run, 'function');
  assert.strictEqual(typeof app.call, 'function');
  assert.strictEqual(typeof app.esc, 'function');
});

test('exports: _isScalar, classifyValue, cellStr', () => {
  assert.strictEqual(typeof app._isScalar, 'function');
  assert.strictEqual(typeof app.classifyValue, 'function');
  assert.strictEqual(typeof app.cellStr, 'function');
});

test('exports: ENDPOINTS, STATIC_ENDPOINTS, isStatic', () => {
  assert.ok(app.ENDPOINTS, 'ENDPOINTS missing');
  assert.ok(Array.isArray(app.ENDPOINTS), 'ENDPOINTS not array');
  assert.ok(app.STATIC_ENDPOINTS, 'STATIC_ENDPOINTS missing');
  assert.ok(Array.isArray(app.STATIC_ENDPOINTS), 'STATIC_ENDPOINTS not array');
  assert.strictEqual(typeof app.isStatic, 'function');
});

test('ENDPOINTS: 11 groups', () => {
  assert.strictEqual(app.ENDPOINTS.length, 11,
    `expected 11 groups, got ${app.ENDPOINTS.length}`);
});

test('ENDPOINTS: each has group + eps', () => {
  app.ENDPOINTS.forEach((g, i) => {
    assert.ok(g.group, `group ${i} missing 'group'`);
    assert.ok(Array.isArray(g.eps), `group ${i} eps not array`);
    assert.ok(g.eps.length > 0, `group ${i} eps empty`);
  });
});

test('ENDPOINTS: total endpoints > 30', () => {
  const total = app.ENDPOINTS.reduce((s, g) => s + g.eps.length, 0);
  assert.ok(total > 30, `expected > 30 endpoints, got ${total}`);
});

test('STATIC_ENDPOINTS: 12 entries', () => {
  assert.strictEqual(app.STATIC_ENDPOINTS.length, 12,
    `expected 12 static, got ${app.STATIC_ENDPOINTS.length}`);
});

// ═══════════════════════════════════════════════════════
// esc()
// ═══════════════════════════════════════════════════════
test('esc: escapes < > & " \'', () => {
  assert.strictEqual(app.esc('<script>'), '&lt;script&gt;');
  assert.strictEqual(app.esc('a&b'), 'a&amp;b');
  assert.strictEqual(app.esc('"x"'), '&quot;x&quot;');
  assert.strictEqual(app.esc("'"), '&#39;');
});

test('esc: plain text unchanged', () => {
  assert.strictEqual(app.esc('hello'), 'hello');
  assert.strictEqual(app.esc('abc123'), 'abc123');
});

// ═══════════════════════════════════════════════════════
// _isScalar()
// ═══════════════════════════════════════════════════════
test('_isScalar: true for null/undefined/number/string/bool', () => {
  assert.strictEqual(app._isScalar(null), true);
  assert.strictEqual(app._isScalar(undefined), true);
  assert.strictEqual(app._isScalar(42), true);
  assert.strictEqual(app._isScalar(0), true);
  assert.strictEqual(app._isScalar('str'), true);
  assert.strictEqual(app._isScalar(''), true);
  assert.strictEqual(app._isScalar(true), true);
  assert.strictEqual(app._isScalar(false), true);
});

test('_isScalar: false for objects/arrays', () => {
  assert.strictEqual(app._isScalar({}), false);
  assert.strictEqual(app._isScalar({a:1}), false);
  assert.strictEqual(app._isScalar([]), false);
  assert.strictEqual(app._isScalar([1,2,3]), false);
});

// ═══════════════════════════════════════════════════════
// classifyValue()
// ═══════════════════════════════════════════════════════
test('classifyValue: v-num, v-bool-t, v-bool-f, v-null', () => {
  assert.strictEqual(app.classifyValue(42), 'v-num');
  assert.strictEqual(app.classifyValue(true), 'v-bool-t');
  assert.strictEqual(app.classifyValue(false), 'v-bool-f');
  assert.strictEqual(app.classifyValue(null), 'v-null');
});

// ═══════════════════════════════════════════════════════
// cellStr()
// ═══════════════════════════════════════════════════════
test('cellStr: primitives', () => {
  assert.strictEqual(app.cellStr(42), '42');
  assert.strictEqual(app.cellStr('abc'), 'abc');
  assert.strictEqual(app.cellStr(true), 'true');
  assert.strictEqual(app.cellStr(null), 'null');
});

// ═══════════════════════════════════════════════════════
// isStatic()
// ═══════════════════════════════════════════════════════
test('isStatic: true for /contacts, /sms, /app/list', () => {
  assert.strictEqual(app.isStatic('/contacts'), true);
  assert.strictEqual(app.isStatic('/contacts?limit=5'), true);
  assert.strictEqual(app.isStatic('/sms'), true);
  assert.strictEqual(app.isStatic('/app/list'), true);
  assert.strictEqual(app.isStatic('/locale'), true);
});

test('isStatic: false for /ping, /battery, /network', () => {
  assert.strictEqual(app.isStatic('/ping'), false);
  assert.strictEqual(app.isStatic('/battery'), false);
  assert.strictEqual(app.isStatic('/network'), false);
  assert.strictEqual(app.isStatic('/sensors'), false);
});

// ═══════════════════════════════════════════════════════
// renderData()
// ═══════════════════════════════════════════════════════
test('renderData: null → empty', () => {
  const out = app.renderData(null);
  assert.ok(out.includes('empty'), 'null should be empty: ' + out);
});

test('renderData: {a:1} → kv table', () => {
  const out = app.renderData({a: 1});
  assert.ok(out.includes('<table'), 'should have table');
  assert.ok(out.includes('<th>a</th>'), 'should have th a');
});

test('renderData: [1,2,3] → code chips', () => {
  const out = app.renderData([1, 2, 3]);
  assert.ok(out.includes('<code>'), 'should have code: ' + out.slice(0, 200));
});

test('renderData: [] → empty array', () => {
  const out = app.renderData([]);
  assert.ok(out.includes('empty'), 'empty array: ' + out);
});

test('renderData: [{x:1},{x:2}] → table with th x', () => {
  const out = app.renderData([{x: 1}, {x: 2}]);
  assert.ok(out.includes('<table'), 'should have table');
  assert.ok(out.includes('<th>x</th>'), 'should have th x');
});

// ═══════════════════════════════════════════════════════
// renderObj() — с вложенным
// ═══════════════════════════════════════════════════════
test('renderObj: scalar → kv table', () => {
  const out = app.renderObj({a: 1, b: 2}, 0);
  assert.ok(out.includes('<table class="kv"'), 'kv table');
  assert.ok(out.includes('<th>a</th>'));
  assert.ok(out.includes('<th>b</th>'));
});

test('renderObj: nested object → details.sub', () => {
  const out = app.renderObj({nested: {x: 1}}, 0);
  assert.ok(out.includes('<details class="sub"'),
    'nested should be details.sub: ' + out.slice(0, 300));
  assert.ok(out.includes('<summary>'), 'should have summary');
});

test('renderObj: nested array → details.sub', () => {
  const out = app.renderObj({items: [{a: 1}]}, 0);
  assert.ok(out.includes('<details class="sub"'),
    'array should be details.sub');
});

test('renderObj: empty → {}', () => {
  const out = app.renderObj({}, 0);
  assert.ok(out.includes('{}'), 'empty object: ' + out);
});

// ═══════════════════════════════════════════════════════
// renderCell() — с вложенным
// ═══════════════════════════════════════════════════════
test('renderCell: scalar → span.v-num', () => {
  const out = app.renderCell(42, 0);
  assert.ok(out.includes('v-num'), 'should be v-num: ' + out);
});

test('renderCell: nested object → details.sub', () => {
  const out = app.renderCell({x: 1}, 0);
  assert.ok(out.includes('<details class="sub"'),
    'nested object → details.sub: ' + out.slice(0, 300));
});

test('renderCell: scalar array → code', () => {
  const out = app.renderCell([1, 2, 3], 0);
  assert.ok(out.includes('<code>'), 'scalar array → code');
});

// ═══════════════════════════════════════════════════════
// index.html / style.css
// ═══════════════════════════════════════════════════════
test('index.html exists', () => {
  assert.ok(fs.existsSync(INDEX_HTML));
});

test('index.html: <link href="/style.css">', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  assert.ok(html.includes('href="/style.css"'), 'style.css link');
});

test('index.html: <script src="/app.js">', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  assert.ok(html.includes('src="/app.js"'), 'app.js script');
});

test('style.css exists', () => {
  assert.ok(fs.existsSync(STYLE_CSS));
});

test('style.css: has --bg, details.ep, details.sub', () => {
  const css = fs.readFileSync(STYLE_CSS, 'utf8');
  assert.ok(css.includes('--bg'), '--bg var');
  assert.ok(css.includes('details.ep'), 'details.ep');
  assert.ok(css.includes('details.sub'), 'details.sub');
});
