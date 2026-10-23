// MTAPI_NODUP_01: regression tests for merges/patch artifacts.
// Специфика app.js/sw.js — дополняет mtapi-universal-js.test.js.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP_JS   = path.resolve(__dirname, '../gocore/cmd/mtapi-server/app.js');
const SW_JS    = path.resolve(__dirname, '../gocore/cmd/mtapi-server/sw.js');
const SO_FILE  = path.resolve(__dirname, '../android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so');
const MAKEFILE = path.resolve(__dirname, '../Makefile');

function readText(p) { return fs.readFileSync(p, 'utf8'); }

// Strip JS comments (//... and /*...*/) — чтобы не ловить фразы в комментариях
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function countDecls(src, name) {
  const fnRe  = new RegExp('^function\\s+' + name + '\\s*\\(', 'gm');
  const varRe = new RegExp('^var\\s+' + name + '\\s*=', 'gm');
  return {
    fn: (src.match(fnRe) || []).length,
    varDecl: (src.match(varRe) || []).length,
    get total() { return this.fn + this.varDecl; },
  };
}

const CRITICAL_FUNCS = [
  'esc', 'cellStr', 'classifyValue',
  'renderLogcatLines', 'reloadLogcat', 'detectLogLevel',
  '_isScalar', '_scalarCell', 'renderCell', 'renderObj', 'renderData',
];

test('app.js: no duplicate function declarations', function() {
  const src = readText(APP_JS);
  const dups = [];
  for (const name of CRITICAL_FUNCS) {
    const c = countDecls(src, name);
    if (c.total > 1) dups.push(name + ' (' + c.total + 'x)');
  }
  assert.strictEqual(dups.length, 0,
    'Дубликаты функций в app.js: ' + dups.join(', '));
});

test('app.js: no duplicate var LOG_LEVEL_TITLES', function() {
  const src = readText(APP_JS);
  const c = countDecls(src, 'LOG_LEVEL_TITLES');
  assert.strictEqual(c.varDecl, 1,
    'LOG_LEVEL_TITLES должен быть объявлен ровно 1 раз, найдено: ' + c.varDecl);
});

test('app.js: no saveAppJs (MTAPI_397 reverted)', function() {
  // stripComments: не ловим упоминания в комментариях (на будущее)
  const src = stripComments(readText(APP_JS));
  assert.ok(!src.includes('saveAppJs'),
    'app.js содержит saveAppJs — сломанный hot-reload (см. коммит 59c1093). ' +
    'Комментарии не считаются.');
});

test('sw.js: no clients.claim() (self-destruct SW)', function() {
  // stripComments: MTAPI_HARD_RESET_77 оставил комментарий
  // "// 3. НЕ вызываем clients.claim()" — не должен ловиться
  const src = stripComments(readText(SW_JS));
  assert.ok(!src.includes('clients.claim'),
    'sw.js содержит РЕАЛЬНЫЙ clients.claim() — вреден для self-destruct SW ' +
    '(MTAPI_HARD_RESET_77). Комментарии не считаются.');
});

test('.so: libmtapi-server.so exists and > 7MB', function() {
  assert.ok(fs.existsSync(SO_FILE),
    'libmtapi-server.so отсутствует: ' + SO_FILE);
  const stat = fs.statSync(SO_FILE);
  assert.ok(stat.size > 7_000_000,
    'libmtapi-server.so слишком мал: ' + stat.size + 'b (ожидается > 7MB)');
});

test('Makefile: clean does NOT rm tracked libmtapi-server.so', function() {
  const src = readText(MAKEFILE);
  assert.ok(!/rm\s+[^\n]*libmtapi-server\.so/.test(src),
    'Makefile содержит rm с libmtapi-server.so — старый баг ' +
    '(clean удалял tracked .so, см. коммит 59c1093)');
});

test('app.js: logcat live timer present (MTAPI_LOGCAT_LIVE)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('_startLogcatLive'), 'нет _startLogcatLive');
  assert.ok(src.includes('_stopLogcatLive'),  'нет _stopLogcatLive');
  assert.ok(src.includes('_logcatLiveTimer'), 'нет _logcatLiveTimer');
  assert.ok(/setInterval\s*\(\s*function\s*\(\s*\)\s*\{[^}]*reloadLogcat/.test(src),
    'нет setInterval, вызывающего reloadLogcat — live не работает');
});

test('app.js: uptime refresh on toggle (MTAPI_UPTIME_REFRESH)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('_attachUptimeRefresh'), 'нет _attachUptimeRefresh — uptime не обновляется при раскрытии');
  assert.ok(src.includes('id="uptime-sub"'), 'нет id="uptime-sub" в renderDebugSections');
  assert.ok(src.includes('id="uptime-pre"'), 'нет id="uptime-pre"');
});

test('app.js: reloadLogcat updates #uptime-pre (MTAPI_UPTIME_LIVE)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('MTAPI_UPTIME_LIVE'),
    'нет MTAPI_UPTIME_LIVE — uptime не обновляется вместе с logcat');
  // Найти начало reloadLogcat
  const idx = src.indexOf('function reloadLogcat');
  assert.ok(idx >= 0, 'function reloadLogcat не найдена');
  // Взять 3000 символов после начала — этого точно достаточно для тела
  // (reloadLogcat ~700 символов)
  const body = src.slice(idx, idx + 3000);
  // Найти конец функции — первая } на нулевом уровне (грубая, но работает)
  // Проще: проверить, что в этом фрагменте есть и uptime-pre, и MTAPI_UPTIME_LIVE
  assert.ok(body.includes('uptime-pre'),
    'reloadLogcat не содержит #uptime-pre — live-обновление сломано');
  assert.ok(body.includes('MTAPI_UPTIME_LIVE'),
    'reloadLogcat не содержит MTAPI_UPTIME_LIVE');
});

test('app.js: reloadLogcat: guard _logcatRefreshing + preserve scroll', function() {
  const src = readText(APP_JS);
  const idx = src.indexOf('function reloadLogcat');
  assert.ok(idx >= 0, 'reloadLogcat не найдена');
  const body = src.slice(idx, idx + 3000);
  assert.ok(body.includes('_logcatRefreshing'), 'нет guard _logcatRefreshing (race)');
  assert.ok(body.includes('wasAtTop'), 'нет preserve scroll (wasAtTop)');
  assert.ok(body.includes('scrollTop'), 'нет сохранения scrollTop');
});

test('app.js: _stopLogcatLive clears timer (beforeExit safety)', function() {
  const src = readText(APP_JS);
  const idx = src.indexOf('function _stopLogcatLive');
  assert.ok(idx >= 0, '_stopLogcatLive не найдена');
  const body = src.slice(idx, idx + 500);
  assert.ok(body.includes('clearInterval'), '_stopLogcatLive не очищает interval');
  assert.ok(body.includes('_logcatLiveTimer = null'), 'не сбрасывает _logcatLiveTimer в null');
});

test('app.js: _startLogcatLive idempotent (no double interval)', function() {
  const src = readText(APP_JS);
  const idx = src.indexOf('function _startLogcatLive');
  assert.ok(idx >= 0, '_startLogcatLive не найдена');
  const body = src.slice(idx, idx + 500);
  // Должен быть guard: if (_logcatLiveTimer) return;
  assert.ok(/if\s*\(\s*window\._logcatLiveTimer\s*\)\s*return/.test(body),
    'нет guard от двойного setInterval');
  assert.ok(body.includes('setInterval'), 'не использует setInterval');
});

test('app.js: _copyEndpointJson respects active filter (MTAPI_COPY_FILTER)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('MTAPI_COPY_FILTER'), 'нет MTAPI_COPY_FILTER');
  assert.ok(src.includes('function _filterJsonByQuery'), 'нет _filterJsonByQuery');
  // _copyEndpointJson должен проверять .tbl-search
  const idx = src.indexOf('function _copyEndpointJson');
  assert.ok(idx >= 0, '_copyEndpointJson не найдена');
  const body = src.slice(idx, idx + 1500);
  assert.ok(body.includes('.tbl-search'), '_copyEndpointJson не проверяет .tbl-search');
  assert.ok(body.includes('_filterJsonByQuery'), '_copyEndpointJson не вызывает _filterJsonByQuery');
});

test('app.js: JS Logs live append (MTAPI_JSLOG_LIVE)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('MTAPI_JSLOG_LIVE'),
    'нет MTAPI_JSLOG_LIVE — JS Logs не обновляются в реальном времени');
  // проверяем, что push() содержит append в #jslog-pre
  const idx = src.indexOf('window._jslogBuf.push(line)');
  assert.ok(idx >= 0, 'window._jslogBuf.push(line) не найден');
  const body = src.slice(idx, idx + 1500);
  assert.ok(body.includes('jslog-pre'), 'push() не обновляет #jslog-pre');
  assert.ok(body.includes('appendChild'), 'push() не делает appendChild');
});

test('app.js: refresh on toggle helpers defined (MTAPI_REFRESH_ON_TOGGLE)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('function _attachRefreshOnToggle'),
    'нет function _attachRefreshOnToggle');
  assert.ok(src.includes('function _attachProcessesAllRefresh'),
    'нет function _attachProcessesAllRefresh');
  assert.ok(src.includes('function _attachUptimeRefresh'),
    'нет function _attachUptimeRefresh');
  assert.ok(src.includes('data-refresh-field="memory"'), 'нет data-refresh-field="memory"');
  assert.ok(src.includes('data-refresh-field="processes"'), 'нет data-refresh-field="processes"');
  assert.ok(src.includes('data-refresh-field="errors"'), 'нет data-refresh-field="errors"');
  assert.ok(src.includes('id="processes-all-sub"'), 'нет id="processes-all-sub"');
});

test('app.js: JS Logs reverse — новые сверху (MTAPI_JSLOG_REVERSE)', function() {
  const src = readText(APP_JS);
  assert.ok(src.includes('MTAPI_JSLOG_REVERSE'),
    'нет MTAPI_JSLOG_REVERSE — JS Logs идут в хронологическом порядке');
  // renderDebugSections — reverse
  const idx1 = src.indexOf('for (var ji = buf.length - 1; ji >= 0; ji--)');
  assert.ok(idx1 >= 0, 'renderDebugSections не итерирует с конца буфера');
  // push() — prepend
  assert.ok(src.includes('pre.insertBefore(frag, pre.firstChild)'),
    'push() не вставляет в начало (prepend)');
});

test('app.js: C2 DevTools — network + sources + elements + application', function() {
  const src = readText(APP_JS);
  // Network
  assert.ok(src.includes('MTAPI_JSLOG_NETWORK'), 'нет MTAPI_JSLOG_NETWORK');
  assert.ok(src.includes("'[net] → '"), 'нет [net] → (request log)');
  assert.ok(src.includes("'[net] ← '"), 'нет [net] ← (response log)');
  // Sources
  assert.ok(src.includes('window._viewAppSource'), 'нет _viewAppSource');
  // Elements
  assert.ok(src.includes('window._inspectDom'), 'нет _inspectDom');
  assert.ok(src.includes('MTAPI_INSPECT_DOM'), 'нет MTAPI_INSPECT_DOM');
  // Application
  assert.ok(src.includes('window._showStorage'), 'нет _showStorage');
  assert.ok(src.includes('MTAPI_SHOW_STORAGE'), 'нет MTAPI_SHOW_STORAGE');
});

test('app.js: no duplicate function names anywhere', function() {
  const src = readText(APP_JS);
  const re = /^function\s+(\w+)\s*\(/gm;
  const names = [];
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  const counts = Object.create(null);
  for (const n of names) counts[n] = (counts[n] || 0) + 1;
  const dups = Object.keys(counts).filter(function(n) { return counts[n] > 1; });
  assert.strictEqual(dups.length, 0,
    'Дубликаты функций: ' + dups.map(function(n) { return n + '(' + counts[n] + ')'; }).join(', '));
});
