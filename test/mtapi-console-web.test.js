// test/mtapi-console-web.test.js
// Tests for /console web page (Go source + jsdom)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const CONSOLE_GO = path.join(__dirname, '..', 'gocore/cmd/mtapi-server/console.go');

function readConsoleBody(token) {
  token = token || 'tok_test';
  const src = fs.readFileSync(CONSOLE_GO, 'utf-8');
  const start = src.indexOf('body := `');
  if (start < 0) throw new Error('body := ` not found in console.go');
  const endMarker = '</body></html>`';
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error('</body></html>` not found in console.go');
  let block = src.substring(start + 'body := `'.length, end + endMarker.length);
  // Remove trailing backtick
  block = block.substring(0, block.length - 1);
  // Replace any Go fmt.Sprintf("%q", token) — but normally token comes from location.search now
  block = block.replace(/`\s*\+\s*fmt\.Sprintf\("%q",\s*token\)\s*\+\s*`/g, '');
  return block;
}

function mkConsoleDom(token) {
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + readConsoleBody() + '</body></html>';
  return new JSDOM(html, {
    url: 'http://127.0.0.1:7788/console?token=' + (token || 'tok_test'),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w._fetchedUrls = [];
      w.fetch = (url) => {
        w._fetchedUrls.push(String(url));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { test: 1 } }),
          text: () => Promise.resolve(''),
        });
      };
    },
  });
}

// ─── SOURCE (fast, CI-safe) ───
test('console.go (source): 5 tabs, no DevTools/Network', () => {
  const src = fs.readFileSync(CONSOLE_GO, 'utf-8');
  for (const t of ['console', 'logs', 'errors', 'logcat', 'sys']) {
    assert.match(src, new RegExp('data-tab="' + t + '"'), 'tab ' + t + ' missing');
  }
  assert.doesNotMatch(src, /data-tab="devtools"/, 'devtools should be removed');
  assert.doesNotMatch(src, /data-tab="net"/, 'network should be removed');
  assert.match(src, /5 tools/, 'title should be 5 tools');
});

test('console.go (source): fetch monkeypatch present', () => {
  const src = fs.readFileSync(CONSOLE_GO, 'utf-8');
  assert.match(src, /_origFetch/);
  assert.match(src, /var TOKEN\s*=/);
  assert.match(src, /'token='/);
});

test('console.go (source): help levels ?, ??, ???', () => {
  const src = fs.readFileSync(CONSOLE_GO, 'utf-8');
  assert.match(src, /cmd === '\?'/, '? handler');
  assert.match(src, /cmd === '\?\?'/, '?? handler');
  assert.match(src, /cmd === '\?\?\?'/, '??? handler');
});

test('console.go (source): log/warn/error defined', () => {
  const src = fs.readFileSync(CONSOLE_GO, 'utf-8');
  assert.match(src, /window\.log\s*=/);
  assert.match(src, /window\.warn\s*=/);
  assert.match(src, /window\.error\s*=/);
});

// ─── jsdom ───
test('/console (jsdom): 5 tabs rendered', () => {
  const dom = mkConsoleDom();
  const tabs = dom.window.document.querySelectorAll('#tabs button');
  assert.strictEqual(tabs.length, 5);
  const labels = Array.from(tabs).map(b => b.textContent);
  assert.deepStrictEqual(labels, ['Console', 'Logs', 'Errors', 'Logcat', 'System']);
});

test('/console (jsdom): 1+1 = 2', async () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.document.getElementById('cmd').value = '1+1';
  await w.run();
  assert.match(w.document.getElementById('out').textContent, /2/);
});

test('/console (jsdom): await fetch (async wrap)', async () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.document.getElementById('cmd').value = "await fetch('/battery').then(r => r.json())";
  await w.run();
  const out = w.document.getElementById('out').textContent;
  assert.match(out, /ok/);
});

test('/console (jsdom): fetch monkeypatch adds ?token=', async () => {
  const dom = mkConsoleDom('testtok123');
  const w = dom.window;
  await w.fetch('/battery');
  assert.strictEqual(w._fetchedUrls.length, 1);
  assert.match(w._fetchedUrls[0], /\/battery\?token=testtok123/);
});

test('/console (jsdom): ??? shows endpoints help', async () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.document.getElementById('cmd').value = '???';
  await w.run();
  const out = w.document.getElementById('out').textContent;
  assert.match(out, /battery/);
  assert.match(out, /sensors/);
  assert.match(out, /system/);
});

test('/console (jsdom): ?? shows cheatsheet', async () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.document.getElementById('cmd').value = '??';
  await w.run();
  const out = w.document.getElementById('out').textContent;
  assert.match(out, /cheatsheet/i);
  assert.match(out, /fetch/);
});

test('/console (jsdom): ? shows quick', async () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.document.getElementById('cmd').value = '?';
  await w.run();
  const out = w.document.getElementById('out').textContent;
  assert.match(out, /quick/i);
});

test('/console (jsdom): log() -> output', async () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.document.getElementById('cmd').value = 'log("hello", 123)';
  await w.run();
  const out = w.document.getElementById('out').textContent;
  assert.match(out, /\[log\] hello 123/);
});

test('/console (jsdom): renderJSON({a:1}) -> <table>', () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  const html = w.renderJSON({ a: 1, b: 'x' });
  assert.match(html, /<table>/);
  assert.match(html, />a</);
  assert.match(html, />1</);
});

test('/console (jsdom): renderJSON(array) -> <table>', () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  const html = w.renderJSON([{ x: 1 }, { x: 2 }]);
  assert.match(html, /<table>/);
  assert.match(html, />x</);
  assert.match(html, />1</);
  assert.match(html, />2</);
});

test('/console (jsdom): hash routing #logcat', () => {
  const dom = mkConsoleDom();
  const w = dom.window;
  w.setTab('logcat');
  assert.ok(w.document.getElementById('pane-logcat').classList.contains('active'));
  assert.ok(!w.document.getElementById('pane-console').classList.contains('active'));
});
