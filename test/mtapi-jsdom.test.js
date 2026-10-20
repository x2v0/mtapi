// test/mtapi-jsdom.test.js — тесты app.js через jsdom (реальный DOM)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const APP_JS = path.resolve(process.env.HOME, 'mtapi/gocore/cmd/mtapi-server/app.js');
const app = require(APP_JS);

test('jsdom: renderData({a:1}) → DOM table', () => {
  const html = app.renderData({a: 1});
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const doc = dom.window.document;
  const table = doc.querySelector('table');
  assert.ok(table, 'should have <table>');
  assert.ok(table.classList.contains('kv'), 'should be kv');
  assert.ok(table.querySelector('th'), 'should have <th>');
});

test('jsdom: renderData([{x:1},{x:2}]) → 2 rows', () => {
  const html = app.renderData([{x: 1}, {x: 2}]);
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const rows = dom.window.document.querySelectorAll('tbody tr');
  assert.strictEqual(rows.length, 2, `expected 2 rows, got ${rows.length}`);
});

test('jsdom: renderObj({nested:{}}) → details.sub', () => {
  const html = app.renderObj({nested: {a: 1}}, 0);
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const details = dom.window.document.querySelectorAll('details.sub');
  assert.ok(details.length >= 1, 'should have details.sub');
  assert.ok(details[0].querySelector('summary'), 'should have summary');
});

test('jsdom: renderObj nested array → details.sub', () => {
  const html = app.renderObj({items: [{a: 1}, {a: 2}]}, 0);
  const dom = new JSDOM(`<div id="x">${html}</div>`);
  const details = dom.window.document.querySelectorAll('details.sub');
  assert.ok(details.length >= 1, 'should have details.sub');
});

test('jsdom: esc prevents injection', () => {
  const html = app.esc('<script>alert(1)</script>');
  const dom = new JSDOM(`<div>${html}</div>`);
  assert.strictEqual(dom.window.document.querySelector('script'), null,
    'should not create <script>');
});
