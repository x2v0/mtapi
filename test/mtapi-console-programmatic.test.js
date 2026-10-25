// test/mtapi-console-programmatic.test.js
// Programmatic API: MtapiDebug.eval(code), window.runCode(code), postMessage
const { test } = require('node:test');
const assert = require('node:assert');
const { mkDebugConsole, mkWebConsole, runDebug } = require('./helpers/console');

// ── Debug console: MtapiDebug.eval ──
test('debug: MtapiDebug.eval("1+1") -> "2"', async () => {
  const dom = mkDebugConsole();
  const w = dom.window;
  const out = await w.MtapiDebug.eval('1+1');
  assert.ok(out, 'returned output');
  assert.match(out, /2/);
});

test('debug: MtapiDebug.eval(await fetch battery)', async () => {
  const dom = mkDebugConsole({ mockFetch: {
    '/battery?token=tok_test': { ok: true, data: { percentage: 92 } }
  }});
  const w = dom.window;
  const out = await w.MtapiDebug.eval("await fetch('/battery').then(r => r.json())");
  assert.match(out, /percentage/);
});

test('debug: MtapiDebug.eval(??) -> cheatsheet', async () => {
  const dom = mkDebugConsole();
  const w = dom.window;
  const out = await w.MtapiDebug.eval('??');
  assert.match(out, /cheatsheet/);
});

test('debug: _evalCode does not throw on error', async () => {
  const dom = mkDebugConsole();
  const w = dom.window;
  const out = await w._evalCode('foo.bar.baz');
  assert.match(out, /Error/);
});

// ── Web console: runCode ──
test('web: runCode("1+1") -> "2"', async () => {
  const dom = mkWebConsole();
  const w = dom.window;
  const out = await w.runCode('1+1');
  assert.ok(out);
  assert.match(out, /2/);
});

test('web: runCode(await fetch battery)', async () => {
  const dom = mkWebConsole({ mockFetch: {
    '/battery?token=tok_test': { ok: true, data: { percentage: 92 } }
  }});
  const w = dom.window;
  const out = await w.runCode("await fetch('/battery').then(r => r.json())");
  assert.match(out, /percentage/);
});

test('web: runCode(log(...)) writes to output', async () => {
  const dom = mkWebConsole();
  const w = dom.window;
  const out = await w.runCode('log("hello", 123)');
  assert.match(out, /\[log\] hello 123/);
});

// ── postMessage (iframe → parent) ──
test('web: postMessage console-eval triggers run', async () => {
  const dom = mkWebConsole();
  const w = dom.window;
  // Attach runCode to check it's called
  let called = false;
  const origRunCode = w.runCode;
  w.runCode = async function(code) { called = true; return origRunCode.call(this, code); };

  const evt = new w.MessageEvent('message', {
    data: { type: 'console-eval', code: '1+1' }
  });
  w.dispatchEvent(evt);
  await new Promise(r => setTimeout(r, 100));
  assert.ok(called, 'runCode was called via postMessage');
});
