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
