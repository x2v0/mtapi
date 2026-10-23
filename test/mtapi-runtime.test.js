// MTAPI_RUNTIME_01: runtime + static tests for renderDebugSections / loadDebugCard
// Ловит ReferenceError (h is not defined), порядок секций, изоляцию фильтров.
// Это то, чего не хватило в прошлой сессии: static tests не запускали код.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP_JS = path.resolve(__dirname, '../gocore/cmd/mtapi-server/app.js');
const APP_SRC = fs.readFileSync(APP_JS, 'utf-8');

// ─────────────────────────────────────────────────────────
// STATIC (regex по исходнику) — ловит битые структуры без запуска
// ─────────────────────────────────────────────────────────

test('app.js: no orphan h += in loadDebugCard (regression)', () => {
  const ldc = APP_SRC.indexOf('function loadDebugCard');
  const rds = APP_SRC.indexOf('function renderDebugSections');
  assert.ok(ldc > 0 && rds > ldc, 'loadDebugCard / renderDebugSections не найдены');
  const between = APP_SRC.slice(ldc, rds);
  const orphanH = (between.match(/^\s*h \+=/gm) || []).length;
  assert.strictEqual(orphanH, 0,
    'loadDebugCard содержит ' + orphanH + " orphan 'h +=' — ReferenceError: h is not defined");
});

test('app.js: renderDebugSections has all 11 sections', () => {
  const rds = APP_SRC.slice(APP_SRC.indexOf('function renderDebugSections'));
  const markers = [
    'data.processes', 'data.port', 'data.uptime', 'data.memory',
    'data.errors', 'processes-all-sub', 'logcat-sub', 'jslog-sub',
    'eval-sub', 'perf-sub', 'devtools-sub',
  ];
  for (const m of markers) {
    assert.ok(rds.includes(m), 'renderDebugSections missing: ' + m);
  }
});

test('app.js: sections order logcat < jslog < eval < perf < devtools', () => {
  const rds = APP_SRC.slice(APP_SRC.indexOf('function renderDebugSections'));
  const order = [
    'id="logcat-sub"', 'id="jslog-sub"', 'id="eval-sub"',
    'id="perf-sub"', 'id="devtools-sub"',
  ];
  let prev = -1;
  for (const marker of order) {
    const idx = rds.indexOf(marker);
    assert.ok(idx > prev, 'order wrong: ' + marker + ' at ' + idx + ' (prev ' + prev + ')');
    prev = idx;
  }
});

// ─────────────────────────────────────────────────────────
// RUNTIME (jsdom + fetch mock) — выполняет код
// ─────────────────────────────────────────────────────────

let dom, APP = null;
try {
  const { JSDOM } = require('jsdom');
  dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<input id="q" type="text">' +
    '<div id="main"></div>' +
    '<span id="st-batt"></span>' +
    '<span id="st-ram"></span>' +
    '<button id="theme"></button>' +
    '<button id="reset"></button>' +
    '<button id="live"></button>' +
    '</body></html>',
    { url: 'http://127.0.0.1:7788/' }
  );
} catch (e) {
  test('runtime: jsdom not installed', () => {
    assert.fail('jsdom не установлен: ' + e.message);
  });
}

if (dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  // Node 26: navigator getter-only → defineProperty
  try {
    Object.defineProperty(global, 'navigator', {
      value: dom.window.navigator,
      configurable: true,
      writable: true,
    });
  } catch (e) { /* ignore */ }
  try {
    global.localStorage = dom.window.localStorage;
  } catch (e) {
    try {
      Object.defineProperty(global, 'localStorage', {
        value: dom.window.localStorage,
        configurable: true,
        writable: true,
      });
    } catch (e2) { /* ignore */ }
  }
  global.TOKEN = 'test-token-abc123';

  global.fetch = function () {
    return Promise.resolve({
      ok: true, status: 200,
      text: function () { return Promise.resolve('(mocked)'); },
      json: function () { return Promise.resolve({
        ok: true,
        data: {
          percentage: 80, charging: false,
          ram: { totalBytes: 100, availableBytes: 60 },
        },
      }); },
    });
  };

  APP = require(APP_JS);

  function _setup(html) {
    global.document.body.innerHTML = html;
  }

  test('runtime: renderDebugSections — all 11 sections', () => {
    const html = APP.renderDebugSections({
      processes: 'p', port: '7788', uptime: '5s', memory: 'm',
      errors: 'err', logcat: '10-22 12:00:00.000 1 1 I TAG: hi',
    });
    for (const id of ['logcat-sub', 'jslog-sub', 'eval-sub', 'perf-sub',
                      'devtools-sub', 'uptime-sub', 'processes-all-sub']) {
      assert.ok(html.includes('id="' + id + '"'), 'missing #' + id);
    }
  });

  test('runtime: renderDebugSections — empty data no crash', () => {
    assert.doesNotThrow(() => APP.renderDebugSections({}));
    assert.doesNotThrow(() => APP.renderDebugSections(null));
    assert.doesNotThrow(() => APP.renderDebugSections(undefined));
  });

  test('runtime: push() appends to buffer + DOM', () => {
    _setup('<details id="jslog-sub"><summary>JS Logs (0)</summary><pre id="jslog-pre"></pre></details>');
    if (!global.window._jslogBuf) global.window._jslogBuf = [];
    const before = global.window._jslogBuf.length;
    console.log('runtime-test-log-XYZ-42');
    assert.ok(global.window._jslogBuf.length > before, 'buffer not appended');
    const pre = global.document.getElementById('jslog-pre');
    assert.ok(pre.innerHTML.includes('runtime-test-log-XYZ-42'), 'DOM not updated');
  });

  test('runtime: _updatePerfDisplay sets text from _perf', () => {
    _setup('<pre id="perf-pre"></pre>');
    global.window._perf = { render: 12, reloadLogcat: 8, loadDebugCard: 140 };
    assert.strictEqual(typeof global.window._updatePerfDisplay, 'function');
    global.window._updatePerfDisplay();
    const pre = global.document.getElementById('perf-pre');
    assert.ok(pre.textContent.includes('12ms'), 'render missing');
    assert.ok(pre.textContent.includes('8ms'), 'reloadLogcat missing');
    assert.ok(pre.textContent.includes('140ms'), 'loadDebugCard missing');
  });

  test('runtime: _perfReset keeps render, resets others', () => {
    _setup('<pre id="perf-pre"></pre>');
    global.window._perf = { render: 42, reloadLogcat: 8, loadDebugCard: 140 };
    global.window._perfReset();
    assert.strictEqual(global.window._perf.render, 42, 'render должен остаться');
    assert.strictEqual(global.window._perf.reloadLogcat, undefined);
    assert.strictEqual(global.window._perf.loadDebugCard, undefined);
  });

  test('runtime: _evalConsole — 1+1 = 2', () => {
    _setup('<input class="eval-input" value="1+1"><pre id="eval-output"></pre>');
    assert.strictEqual(typeof global.window._evalConsole, 'function');
    global.window._evalConsole();
    const out = global.document.getElementById('eval-output');
    assert.strictEqual(out.textContent, '2');
  });

  test('runtime: _evalConsole — bad input → Error', () => {
    _setup('<input class="eval-input" value="null.foo"><pre id="eval-output"></pre>');
    global.window._evalConsole();
    const out = global.document.getElementById('eval-output');
    assert.ok(out.textContent.indexOf('Error:') === 0, 'ожидалось Error: ...');
  });

  test('runtime: filterJsLog не трогает logcat', () => {
    _setup(
      '<details id="logcat-sub">' +
      '<input type="text" class="logcat-search" value="">' +
      '<pre id="logcat-pre"><span class="logcat-line">keep-me</span></pre>' +
      '</details>' +
      '<details id="jslog-sub">' +
      '<input type="text" class="jslog-search" value="hide">' +
      '<pre id="jslog-pre">' +
      '<span class="logcat-line lvl-v" data-orig="hide me">hide me</span>' +
      '<span class="logcat-line lvl-v" data-orig="show me">show me</span>' +
      '</pre>' +
      '</details>'
    );
    global.window.filterJsLog();
    assert.ok(global.document.getElementById('logcat-pre').innerHTML.includes('keep-me'),
      'logcat был затронут filterJsLog');
    const lines = global.document.querySelectorAll('#jslog-pre .logcat-line');
    assert.strictEqual(lines[0].style.display, '', 'первая строка должна быть видима');
    assert.strictEqual(lines[1].style.display, 'none', 'вторая строка должна быть скрыта');
  });

  test('runtime: filterLogcat не трогает jslog', () => {
    _setup(
      '<details id="logcat-sub">' +
      '<div class="logcat-levels"><label class="logcat-lvl">' +
      '<input type="checkbox" data-lvl="I" checked></label></div>' +
      '<input type="text" class="logcat-search" value="keep">' +
      '<pre id="logcat-pre">' +
      '<span class="logcat-line lvl-i" data-orig="keep this">keep this</span>' +
      '<span class="logcat-line lvl-i" data-orig="other">other</span>' +
      '</pre>' +
      '</details>' +
      '<details id="jslog-sub">' +
      '<input type="text" class="jslog-search" value="keep">' +
      '<pre id="jslog-pre">' +
      '<span class="logcat-line lvl-v" data-orig="keep jslog">keep jslog</span>' +
      '<span class="logcat-line lvl-v" data-orig="other jslog">other jslog</span>' +
      '</pre>' +
      '</details>'
    );
    global.window.filterLogcat();
    const jslogLines = global.document.querySelectorAll('#jslog-pre .logcat-line');
    assert.strictEqual(jslogLines[0].style.display, '', 'filterLogcat затронул jslog');
    assert.strictEqual(jslogLines[1].style.display, '', 'filterLogcat затронул jslog');
  });

  test('runtime: loadDebugCard — body has no ReferenceError (regression)', async () => {
    _setup('<details class="ep" id="rt-ep"><span class="status"></span><div class="ep-b"></div></details>');
    const ep = global.document.getElementById('rt-ep');
    APP.loadDebugCard(ep);
    await new Promise(r => setTimeout(r, 300));
    const body = ep.querySelector('.ep-b');
    const html = (body && body.innerHTML) || '';
    assert.ok(html.indexOf('is not defined') < 0,
      'body содержит "is not defined": ' + html.slice(0, 300));
    assert.ok(html.indexOf('ReferenceError') < 0,
      'body содержит "ReferenceError": ' + html.slice(0, 300));
  });

  test('runtime: render() — no crash', () => {
    _setup('<input id="q" type="text"><div id="main"></div>');
    assert.doesNotThrow(() => APP.render());
    const main = global.document.getElementById('main');
    assert.ok(main, 'main не найден');
    assert.ok(main.innerHTML.length > 0, 'main.innerHTML пуст');
  });
}
