// test/mtapi-console-data.test.js
// Data-driven tests: { cmd, expect, mock? } -> run -> assert
const { test } = require('node:test');
const assert = require('node:assert');
const { mkDebugConsole, runDebug, mkWebConsole, runWeb } = require('./helpers/console');

const CASES = [
  // ── Арифметика ──
  { cmd: '1+1',                 text: '2' },
  { cmd: '2*3',                 text: '6' },
  { cmd: '"hello".toUpperCase()', text: 'HELLO' },
  { cmd: 'Math.max(1,2,3)',     text: '3' },

  // ── undefined / null ──
  { cmd: 'undefined',           text: 'undefined' },
  { cmd: 'null',                text: 'null' },

  // ── Объекты (JSON) ──
  { cmd: '({a:1})',             text: '"a": 1' },
  { cmd: '[1,2,3]',             text: '1' },

  // ── await fetch (mock) ──
  {
    cmd: "await fetch('/battery').then(r => r.json())",
    mock: { '/battery?token=tok_test': { ok: true, data: { percentage: 92 } } },
    text: 'percentage',
  },
  {
    cmd: "await fetch('/system').then(r => r.json())",
    mock: { '/system?token=tok_test': { ok: true, data: { model: 'X' } } },
    text: 'model',
  },

  // ── Ошибки ──
  { cmd: 'foo.bar',             text: 'Error' },
  { cmd: 'throw new Error("x")', text: 'Error' },

  // ── help ?/??/??? ──
  { cmd: '?',                   text: 'quick' },
  { cmd: '??',                  text: 'cheatsheet' },
  { cmd: '???',                 text: 'battery' },
];

// Debug overlay console
for (const c of CASES) {
  test('debug: ' + c.cmd.slice(0, 40), async () => {
    const dom = mkDebugConsole({ mockFetch: c.mock });
    const res = await runDebug(dom, c.cmd);
    assert.ok(res.text.includes(c.text),
      `expected "${c.text}" in "${res.text.slice(0, 200)}"`);
  });
}

// Web /console
for (const c of CASES) {
  test('web: ' + c.cmd.slice(0, 40), async () => {
    const dom = mkWebConsole({ mockFetch: c.mock });
    const res = await runWeb(dom, c.cmd);
    assert.ok(res.text.includes(c.text),
      `expected "${c.text}" in "${res.text.slice(0, 200)}"`);
  });
}
