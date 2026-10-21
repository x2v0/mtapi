// mtapi-syntax.test.js — SyntaxError + id/guard проверки
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

const SRV = path.resolve(process.env.HOME, 'mtapi/gocore/cmd/mtapi-server');
const APP_JS = path.join(SRV, 'app.js');
const INDEX_HTML = path.join(SRV, 'index.html');

// ═══════════════════════════════════════════════════════
// 1. node --check app.js
// ═══════════════════════════════════════════════════════
test('app.js has no SyntaxError', () => {
  assert.doesNotThrow(() => {
    execFileSync('node', ['--check', APP_JS], { stdio: 'pipe', timeout: 10000 });
  }, 'node --check failed');
});

// ═══════════════════════════════════════════════════════
// 2. jsdom: app.js loads without throwing
// ═══════════════════════════════════════════════════════
test('app.js loads in jsdom (no runtime errors)', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8').replace(/\{\{TOKEN\}\}/g, 'test-token-123');
  const js = fs.readFileSync(APP_JS, 'utf8');
  
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:7788/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  
  // stub fetch
  dom.window.fetch = () => Promise.resolve({ json: () => Promise.resolve({ok:true,data:{}}), ok: true, status: 200 });
  dom.window.console = { log: ()=>{}, warn: ()=>{}, error: ()=>{} };
  
  assert.doesNotThrow(() => {
    const script = dom.window.document.createElement('script');
    script.textContent = js;
    dom.window.document.body.appendChild(script);
  }, 'app.js threw at load');
});

// ═══════════════════════════════════════════════════════
// 3. all getElementById exist in index.html
// ═══════════════════════════════════════════════════════
test('all getElementById targets exist in index.html', () => {
  const js = fs.readFileSync(APP_JS, 'utf8');
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  
  const usedIds = new Set(
    (js.match(/getElementById\(['"]([^'"]+)['"]\)/g) || [])
      .map(s => s.match(/['"]([^'"]+)['"]/)[1])
  );
  const htmlIds = new Set(
    (html.match(/id="([^"]+)"/g) || []).map(s => s.match(/id="([^"]+)"/)[1])
  );
  
  const missing = [...usedIds].filter(id => !htmlIds.has(id) && id !== '');
  assert.deepStrictEqual(missing, [], 
    'app.js references IDs not in index.html: ' + missing.join(', '));
});

// ═══════════════════════════════════════════════════════
// 4. every getElementById has null guard
// ═══════════════════════════════════════════════════════
test('every getElementById has null guard', () => {
  const js = fs.readFileSync(APP_JS, 'utf8');
  const lines = js.split('\n');
  const violations = [];
  
  lines.forEach((line, i) => {
    const m = line.match(/document\.getElementById\(['"]([^'"]+)['"]\)\.(\w+)/);
    if (m) {
      const prev = i > 0 ? lines[i-1] : '';
      const ctx = prev + ' ' + line;
      const hasGuard = /if\s*\(/.test(ctx) || /\?\?/.test(ctx) || /\.\?/.test(ctx) || /\|\|/.test(ctx);
      if (!hasGuard) {
        violations.push((i+1) + ': ' + m[0]);
      }
    }
  });
  
  assert.deepStrictEqual(violations, [],
    'Unguarded getElementById:\n' + violations.join('\n'));
});

// ═══════════════════════════════════════════════════════
// 5. addEventListener targets exist
// ═══════════════════════════════════════════════════════
test('all addEventListener targets exist in index.html', () => {
  const js = fs.readFileSync(APP_JS, 'utf8');
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const htmlIds = new Set((html.match(/id="([^"]+)"/g) || []).map(s => s.match(/id="([^"]+)"/)[1]));
  
  const re = /document\.getElementById\(['"]([^'"]+)['"]\)\.addEventListener/g;
  const missing = [];
  let m;
  while ((m = re.exec(js)) !== null) {
    if (!htmlIds.has(m[1])) missing.push(m[1]);
  }
  
  assert.deepStrictEqual(missing, [],
    'addEventListener on non-existent IDs: ' + missing.join(', '));
});

// ═══════════════════════════════════════════════════════
// 6. main.innerHTML not empty
// ═══════════════════════════════════════════════════════
test('main.innerHTML is not empty after render()', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8').replace(/\{\{TOKEN\}\}/g, 'test-token-123');
  const js = fs.readFileSync(APP_JS, 'utf8');
  
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:7788/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  
  dom.window.fetch = () => Promise.resolve({ json: () => Promise.resolve({ok:true,data:{}}), ok: true, status: 200 });
  dom.window.console = { log: ()=>{}, warn: ()=>{}, error: ()=>{} };
  
  const script = dom.window.document.createElement('script');
  script.textContent = js;
  dom.window.document.body.appendChild(script);
  
  const main = dom.window.document.getElementById('main');
  assert.ok(main, 'main not found');
  assert.ok(main.innerHTML.length > 0, 'main.innerHTML is empty (' + main.innerHTML.length + ' chars)');
  console.log('  main.innerHTML:', main.innerHTML.length, 'chars');
});
