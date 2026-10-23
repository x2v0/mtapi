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
    pretendToBeVisual: true,
  });
}

function mockFetch(w, status, body) {
  w.fetch = function() {
    return Promise.resolve({
      status: status || 200,
      headers: { get: (k) => k === 'content-type' ? 'application/json' : (k === 'content-length' ? String((body||'').length) : null) },
      clone: () => ({ text: () => Promise.resolve(body || '') }),
    });
  };
}

test('Network: fetch interceptor captures entry', async () => {
  const w = mk().window;
  mockFetch(w, 200, '{"a":1}');
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  await w.fetch('/test', { method: 'GET' });
  assert.strictEqual(w._netBuf.length, 1);
  const e = w._netBuf[0];
  assert.strictEqual(e.method, 'GET');
  assert.strictEqual(e.url, '/test');
  assert.strictEqual(e.status, 200);
  assert.strictEqual(e.body, null);
});

test('Network: verbose captures body', async () => {
  const w = mk().window;
  w._netVerbose = true;
  mockFetch(w, 200, '{"hello":"world"}');
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  await w.fetch('/data');
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(w._netBuf.length, 1);
  assert.strictEqual(w._netBuf[0].body, '{"hello":"world"}');
});

test('Network: renderNetwork returns table with URL', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  w._netBuf.push({ t: Date.now(), method: 'GET', url: '/x', status: 200, ms: 10, size: '5', ct: 'application/json', body: null });
  w._netRefresh();
  const section = w.document.getElementById('mtapi-debug-network');
  assert.ok(section, 'network section exists');
  assert.ok(section.textContent.includes('/x'), 'URL visible');
  assert.ok(section.textContent.includes('200'), 'status visible');
});

test('DOM inspector: helpers exist', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  assert.strictEqual(typeof w._domRefresh, 'function');
  assert.strictEqual(typeof w._domInspect, 'function');
  assert.ok(w.document.getElementById('mtapi-debug-dom'), 'DOM section exists');
});

test('DOM inspector: _domRefresh fills pre with outerHTML', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  w._domRefresh();
  const pre = w.document.getElementById('mtapi-debug-dom');
  assert.ok(pre.textContent.includes('<html'), 'outerHTML visible');
  assert.ok(pre.textContent.includes('id="h"'), 'h1 in outerHTML');
});
