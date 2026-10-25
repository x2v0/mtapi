// test/mtapi-debug-console.test.js
// Tests for Console Eval in debug overlay (mtapi-debug.js) — jsdom
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gocore/cmd/mtapi-server/mtapi-debug.js'), 'utf-8');

function mkDebug() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://127.0.0.1:7788/?token=tok_test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w._fetchedUrls = [];
  w.fetch = (url) => {
    w._fetchedUrls.push(String(url));
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      text: () => Promise.resolve(''),
    });
  };
  w.eval(SRC);
  return dom;
}

test('debug console: _evalConsole is async', () => {
  const dom = mkDebug();
  const fn = dom.window._evalConsole;
  assert.strictEqual(typeof fn, 'function');
  assert.match(fn.toString(), /^async function/);
});

test('debug console: _evalConsole has async wrap for await', () => {
  const dom = mkDebug();
  const src = dom.window._evalConsole.toString();
  assert.match(src, /async \(\) => \{ return \(/, 'async wrap for await must be present');
});

test('debug console: 1+1 = 2', async () => {
  const dom = mkDebug();
  const w = dom.window;
  w.MtapiDebug.attach({ container: w.document.body });
  const inp = w.document.querySelector('.mtapi-dbg-eval-input');
  assert.ok(inp, 'eval input exists');
  inp.value = '1+1';
  await w._evalConsole();
  const out = w.document.getElementById('mtapi-debug-eval-out');
  assert.match(out.textContent, /2/);
});

test('debug console: await fetch (async wrap)', async () => {
  const dom = mkDebug();
  const w = dom.window;
  w.MtapiDebug.attach({ container: w.document.body });
  const inp = w.document.querySelector('.mtapi-dbg-eval-input');
  inp.value = "await fetch('/battery').then(r => r.json())";
  await w._evalConsole();
  const out = w.document.getElementById('mtapi-debug-eval-out');
  assert.match(out.textContent, /ok/);
});

test('debug console: fetch monkeypatch adds ?token=', async () => {
  const dom = mkDebug();
  const w = dom.window;
  w.MtapiDebug.attach({ container: w.document.body });
  await w.fetch('/battery');
  assert.strictEqual(w._fetchedUrls.length, 1);
  assert.match(w._fetchedUrls[0], /token=/);
});

test('debug console: log/warn/error defined', () => {
  const dom = mkDebug();
  const w = dom.window;
  assert.strictEqual(typeof w.log, 'function');
  assert.strictEqual(typeof w.warn, 'function');
  assert.strictEqual(typeof w.error, 'function');
});

test('debug console: help()/??/??? direct (not via eval)', () => {
  const dom = mkDebug();
  const w = dom.window;
  const src = w._evalConsole.toString();
  assert.match(src, /cmd === '\?\?'/, '?? handler');
  assert.match(src, /cmd === '\?\?\?'/, '??? handler');
  assert.match(src, /help\(\)/, 'help() handler');
});
