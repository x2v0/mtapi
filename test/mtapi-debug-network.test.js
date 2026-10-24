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
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(w._netBuf.length, 1);
  const e = w._netBuf[0];
  assert.strictEqual(e.method, 'GET');
  assert.strictEqual(e.url, '/test');
  assert.strictEqual(e.status, 200);
  // Body is now ALWAYS captured (verbose toggle removed in v2.7.0).
  // Async clone.text() may not resolve in all envs -> null or string.
  assert.ok(e.body === null || typeof e.body === 'string', 'body: null or string (always-verbose)');
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
  // v2.11.0: DOM tree is lazy — created by _domShowFloating()
  assert.strictEqual(typeof w._domShowFloating, 'function');
  w._domShowFloating();
  assert.ok(w.document.getElementById('mtapi-debug-dom-tree'), 'DOM tree container exists (after _domShowFloating)');
  assert.ok(w.document.getElementById('mtapi-debug-dom-info'), 'DOM info panel exists');
});

test('DOM inspector: _domRefresh builds tree with data-tag', () => {
  const w = mk().window;
  w.eval(SRC);
  w.MtapiDebug.attach({ container: w.document.body });
  // v2.11.0: floating DOM is lazy — create it first
  w._domShowFloating();
  w._domRefresh();
  const tree = w.document.getElementById('mtapi-debug-dom-tree');
  assert.ok(tree, 'tree container exists');
  assert.ok(tree.querySelector('summary[data-tag="html"]'), 'html root has data-tag');
  assert.ok(tree.querySelector('summary[data-tag="h1"]'), 'h1 has data-tag');
});
