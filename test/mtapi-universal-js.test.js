// MTAPI_UNIVERSAL_JS: общие проверки для КАЖДОГО .js в проекте.
// Дополняет mtapi-nodup.test.js (там специфика app.js/sw.js).
// Находит общие регрессии: битые файлы, merge-артефакты, дубликаты, debugger, eval.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'build', 'dist',
  '.gradle', '.cache', 'coverage', '.idea', '.vscode',
  'target', '__pycache__', '.pytest_cache',
]);

// ─── discovery ────────────────────────────────────────────
function findJsFiles(dir, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name.length > 1) continue; // .hidden
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) findJsFiles(full, out);
    else if (ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const FILES = findJsFiles(ROOT).sort();
const PRODUCTION = FILES.filter(function(f) {
  return f.indexOf(path.sep + 'test' + path.sep) === -1;
});

function rel(p) { return path.relative(ROOT, p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// ─── 1. sanity ────────────────────────────────────────────
test('universal: found .js files in project', function() {
  assert.ok(FILES.length > 0, 'Не найдено ни одного .js файла в ' + rel(ROOT));
  assert.ok(PRODUCTION.length >= 2,
    'Ожидается ≥2 production .js, найдено: ' + PRODUCTION.length);
  console.log('  found ' + FILES.length + ' .js files:');
  for (const f of FILES) console.log('    ' + rel(f));
});

// ─── 2. non-empty ─────────────────────────────────────────
test('universal: all .js non-empty', function() {
  for (const f of FILES) {
    const sz = fs.statSync(f).size;
    assert.ok(sz > 0, rel(f) + ' пустой (0 байт)');
  }
});

// ─── 3. valid UTF-8 ───────────────────────────────────────
test('universal: all .js valid UTF-8', function() {
  for (const f of FILES) {
    const buf = fs.readFileSync(f);
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (e) {
      assert.fail(rel(f) + ' не валидный UTF-8: ' + e.message);
    }
  }
});

// ─── 4. node --check (parse) ──────────────────────────────
test('universal: all .js parse without SyntaxError', function() {
  const errors = [];
  for (const f of FILES) {
    try {
      execFileSync('node', ['--check', f], { stdio: 'pipe', timeout: 5000 });
    } catch (e) {
      const raw = e.stderr ? e.stderr.toString() : (e.message || '');
      const msg = raw.split('\n').slice(0, 4).join('\n');
      errors.push(rel(f) + ':\n' + msg);
    }
  }
  assert.strictEqual(errors.length, 0,
    'Синтаксические ошибки (' + errors.length + '):\n\n' + errors.join('\n\n'));
});

// ─── 5. no merge conflict markers ─────────────────────────
test('universal: no merge conflict markers', function() {
  const patterns = [
    ['<<<<<<<', /^<{7}/m],
    ['=======', /^={7}$/m],
    ['>>>>>>>', /^>{7}/m],
  ];
  const found = [];
  for (const f of FILES) {
    const src = read(f);
    for (const p of patterns) {
      if (p[1].test(src)) found.push(rel(f) + ' → ' + p[0]);
    }
  }
  assert.strictEqual(found.length, 0,
    'Merge conflict markers:\n' + found.join('\n'));
});

// ─── 6. no debugger; (production) ─────────────────────────
test('universal: no debugger statements in production', function() {
  const found = [];
  for (const f of PRODUCTION) {
    const lines = read(f).split('\n');
    lines.forEach(function(ln, i) {
      // только целая строка debugger; (не в комментарии)
      if (/^\s*debugger\s*;?\s*(\/\/.*)?$/.test(ln)) {
        found.push(rel(f) + ':' + (i + 1) + ' → ' + ln.trim());
      }
    });
  }
  assert.strictEqual(found.length, 0,
    'Debugger statements:\n' + found.join('\n'));
});

// ─── 7. no duplicate top-level functions ──────────────────
test('universal: no duplicate top-level function declarations', function() {
  const found = [];
  for (const f of FILES) {
    const src = read(f);
    const re = /^function\s+(\w+)\s*\(/gm;
    const names = [];
    let m;
    while ((m = re.exec(src)) !== null) names.push(m[1]);
    const counts = Object.create(null);
    for (const n of names) counts[n] = (counts[n] || 0) + 1;
    for (const n of Object.keys(counts)) {
      if (counts[n] > 1) found.push(rel(f) + ': ' + n + ' (' + counts[n] + 'x)');
    }
  }
  assert.strictEqual(found.length, 0,
    'Дубликаты функций:\n' + found.join('\n'));
});

// ─── 8. no eval() / new Function() (production) ───────────
test('universal: no eval() / new Function() in production', function() {
  const found = [];
  for (const f of PRODUCTION) {
    const lines = read(f).split('\n');
    lines.forEach(function(ln, i) {
      // пропускаем строки-комментарии
      if (/^\s*(\/\/|\*)/.test(ln)) return;
      if (/\beval\s*\(/.test(ln) || /\bnew\s+Function\s*\(/.test(ln)) {
        found.push(rel(f) + ':' + (i + 1) + ' → ' + ln.trim().slice(0, 80));
      }
    });
  }
  assert.strictEqual(found.length, 0,
    'eval()/new Function() в production:\n' + found.join('\n'));
});

// ─── 9. self-test: node --check реально работает ─────────
test('universal: node --check detects syntax errors (self-test)', function() {
  const tmp = path.join(__dirname, '.smoke-' + process.pid + '.js');
  try {
    fs.writeFileSync(tmp, 'function broken( { return 1; }\n', 'utf8');
    let failed = false;
    try {
      execFileSync('node', ['--check', tmp], { stdio: 'pipe', timeout: 5000 });
    } catch (e) {
      failed = true;
    }
    assert.ok(failed,
      'node --check НЕ поймал заведомо битый синтаксис — механизм проверки сломан');
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
});

// ─── 10. summary ──────────────────────────────────────────
test('universal: summary', function() {
  const prodBytes = PRODUCTION.reduce(function(s, f) {
    return s + fs.statSync(f).size;
  }, 0);
  const testCount = FILES.length - PRODUCTION.length;
  console.log('');
  console.log('  ── summary ──');
  console.log('  production: ' + PRODUCTION.length + ' файл(ов), ' + prodBytes + 'b');
  console.log('  test:       ' + testCount + ' файл(ов)');
  console.log('  всего:      ' + FILES.length + ' файл(ов)');
});
