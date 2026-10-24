'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(path.resolve(__dirname, '../gocore/cmd/mtapi-server/mtapi-debug.js'), 'utf-8');

function mk() {
  return new JSDOM('<html><body><h1 id="h">Test</h1><button class="btn">Btn</button></body></html>', {
    url: 'http://127.0.0.1:7788/',
    runScripts: 'outside-only',
  });
}

// ─── 1. Logcat reverse ───
test('Logcat reverse: split + reverse', () => {
  const w = mk().window;
  w.eval(SRC);
  // Mock AndroidLogcat
  w.AndroidLogcat = {
    getLogcat: () => 'line1\nline2\nline3',
  };
  // Call renderLogcatSection indirectly: it's not exported, but _logcatRefresh is
  const card = w.MtapiDebug.attach({ container: w.document.body });
  // Card should have Logcat section
  const logcat = w.document.getElementById('mtapi-debug-logcat');
  assert.ok(logcat, 'Logcat <pre> должен быть в card');
  // Первая строка должна быть "line3" (reverse)
  const cells = logcat.querySelectorAll('td.logcat-line');
  const first = cells.length ? cells[0].textContent : logcat.textContent.split('\n')[0];
  assert.strictEqual(first, 'line3', 'logcat должен быть reverse (line3 сверху)');
});

// ─── 2. perf API ───
test('perf API: MtapiDebug.perf(label, ms)', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  const res = w.MtapiDebug.perf('test-metric', 42);
  assert.strictEqual(res, 'test-metric: 42ms');
  const perfPre = w.document.getElementById('mtapi-debug-perf');
  assert.ok(perfPre.textContent.includes('test-metric : 42ms'), 'Performance должен показать test-metric');
});

test('perf API: time + timeEnd', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  w.MtapiDebug.time('loop');
  // Симулируем работу
  const start = Date.now();
  while (Date.now() - start < 10) {} // 10ms
  const res = w.MtapiDebug.timeEnd('loop');
  assert.ok(res.startsWith('loop: '), 'timeEnd должен вернуть "loop: Nms"');
  assert.ok(res.endsWith('ms'), 'timeEnd формат: "label: Nms"');
});

test('perf API: timeEnd без time → "no timer"', () => {
  const w = mk().window;
  w.eval(SRC);
  const res = w.MtapiDebug.timeEnd('nonexistent');
  assert.strictEqual(res, 'no timer: nonexistent');
});

// ─── 3. Clear → (0) ───
test('Clear: счётчик (N) → (0)', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });

  // 3 лога
  w.console.log('test 1');
  w.console.log('test 2');
  w.console.log('test 3');

  const countEl = w.document.getElementById('mtapi-debug-jslog-count');
  assert.ok(countEl, 'jslog-count должен быть');
  assert.strictEqual(countEl.textContent, '(3)');

  // Симулируем Clear (onclick attribute, NOT property — JSDOM outside-only)
  // With runScripts: 'outside-only', inline onclick is not compiled to a function.
  // Read the attribute string and eval it in the window context.
  const clearBtns = Array.from(w.document.querySelectorAll('button')).filter(b =>
    (b.getAttribute('aria-label') === 'Clear' || b.getAttribute('title') === 'Clear' || b.textContent === 'Clear') &&
    b.getAttribute('onclick')
  );
  const jslogClear = clearBtns.find(b => (b.getAttribute('onclick') || '').includes('_jslogBuf'));
  assert.ok(jslogClear, 'Clear JS Logs button (by onclick attribute)');
  w.eval(jslogClear.getAttribute('onclick'));

  assert.strictEqual(countEl.textContent, '(0)', 'после Clear → (0)');
});

// ─── 4. global→window в onclick ───
test('global→window: 3 onclick (Clear, Run, Reset)', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  const html = w.document.body.innerHTML;

  assert.ok(!html.includes('onclick="global.'), 'не должно быть onclick="global."');
  assert.ok(html.includes('onclick="window._jslogBuf'), 'Clear: window._jslogBuf');
  assert.ok(html.includes('onclick="window._evalConsole'), 'Run: window._evalConsole');
  assert.ok(html.includes('onclick="window._perfReset'), 'Reset: window._perfReset');
});

// ─── 5. globals: MtapiDebug API ───
test('API: version / buffer / errors / log / perf / time / timeEnd', () => {
  const w = mk().window;
  w.eval(SRC);
  assert.strictEqual(w.MtapiDebug.version, '0.2.0');
  assert.strictEqual(typeof w.MtapiDebug.buffer, 'function');
  assert.strictEqual(typeof w.MtapiDebug.errors, 'function');
  assert.strictEqual(typeof w.MtapiDebug.log, 'function');
  assert.strictEqual(typeof w.MtapiDebug.perf, 'function');
  assert.strictEqual(typeof w.MtapiDebug.time, 'function');
  assert.strictEqual(typeof w.MtapiDebug.timeEnd, 'function');
});

// ─── 6. Persistence: errors → localStorage ───
test('Errors persistent: throw → localStorage', () => {
  const w = mk().window;
  w.eval(SRC);
  w.console.error(new Error('persist-test'));
  const errors = w.MtapiDebug.errors();
  assert.ok(errors.length > 0, 'errors persistent должен содержать запись');
  assert.ok(errors[0].m.includes('persist-test'));
});

// ─── 7. Clear persistent ───
test('Clear persistent: errors → []', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  w.console.error(new Error('boom-1'));
  w.console.error(new Error('boom-2'));
  assert.ok(w.MtapiDebug.errors().length >= 2);

  w._persistErrorsClear && w._persistErrorsClear();
  // После Clear — localStorage пуст
  const errors2 = JSON.parse(w.localStorage.getItem('mtapi-errors') || '[]');
  assert.strictEqual(errors2.length, 0);
});
