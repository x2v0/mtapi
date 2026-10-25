// test/helpers/console.js
// Универсальный helper для тестирования JS Console (debug + web)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC_DEBUG = path.join(__dirname, '..', '..', 'gocore/cmd/mtapi-server/mtapi-debug.js');
const SRC_CONSOLE_GO = path.join(__dirname, '..', '..', 'gocore/cmd/mtapi-server/console.go');

// ── Debug overlay console ──
function mkDebugConsole(opts) {
  opts = opts || {};
  const src = fs.readFileSync(SRC_DEBUG, 'utf-8');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://127.0.0.1:7788/?token=' + (opts.token || 'tok_test'),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  // mock fetch
  w._fetches = [];
  w.fetch = function(url, o) {
    w._fetches.push({ url: String(url), opts: o });
    const body = (opts.mockFetch && opts.mockFetch[String(url)]) || { ok: true, data: { mock: 1 } };
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  };
  w.eval(src);
  w.MtapiDebug.attach({ container: w.document.body });
  return dom;
}

async function runDebug(dom, cmd) {
  const w = dom.window;
  const inp = w.document.querySelector('.mtapi-dbg-eval-input');
  if (!inp) throw new Error('.mtapi-dbg-eval-input not found');
  inp.value = cmd;
  await w._evalConsole();
  const out = w.document.getElementById('mtapi-debug-eval-out');
  if (!out) throw new Error('#mtapi-debug-eval-out not found');
  return {
    text: out.textContent || '',
    html: out.innerHTML || '',
  };
}

// ── Web /console page ──
function mkWebConsole(opts) {
  opts = opts || {};
  const go = fs.readFileSync(SRC_CONSOLE_GO, 'utf-8');
  const m = go.match(/body\s*:=\s*`([\s\S]*?)`\n/);
  if (!m) throw new Error('console body not found');
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + m[1] + '</body></html>';
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:7788/console?token=' + (opts.token || 'tok_test'),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w._fetches = [];
      w.fetch = function(url, o) {
        w._fetches.push({ url: String(url), opts: o });
        const body = (opts.mockFetch && opts.mockFetch[String(url)]) || { ok: true, data: { mock: 1 } };
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      };
    },
  });
  return dom;
}

async function runWeb(dom, cmd) {
  const w = dom.window;
  const inp = w.document.getElementById('cmd');
  if (!inp) throw new Error('#cmd not found');
  inp.value = cmd;
  await w.run();
  const out = w.document.getElementById('out');
  if (!out) throw new Error('#out not found');
  return {
    text: out.textContent || '',
    html: out.innerHTML || '',
  };
}

module.exports = {
  mkDebugConsole, runDebug,
  mkWebConsole, runWeb,
};
