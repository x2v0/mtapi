---
title: "Debug overlay"
weight: 30
bookToc: false
---

<h1>🐞 Debug overlay (7 табов)</h1>
<p>FAB 🐞 (16×16) в header mtapi → overlay. Topbar: ⚙️ (back) + 7 табов + 🐞 (side panel).</p>
<h2>7 табов</h2>
<table><thead><tr><th>Tab</th><th>Что</th></tr></thead><tbody>
<tr><td><b>Logs</b></td><td>JS Logs (V/D/I/W/E/F фильтры, search, copy, clear, timer 2с, scrollbar)</td></tr>
<tr><td><b>Console</b></td><td>Console Eval — textarea (multiline, Ctrl+Enter), ▶ 📋 🗑 ? 🌳</td></tr>
<tr><td><b>Errors</b></td><td>Persistent errors (localStorage)</td></tr>
<tr><td><b>Logcat</b></td><td>6 колонок: Time | PID | TID | L | Tag | Message. Цвета. Фильтры. Copy. Clear</td></tr>
<tr><td><b>DevTools</b></td><td>adb инструкции + /devtools/json + Load app.js</td></tr>
<tr><td><b>System</b></td><td>Performance (таблица) + System info (uptime, port, JS heap, processes)</td></tr>
<tr><td><b>Network</b></td><td>Requests (fetch logged). Verbose, copy, clear</td></tr>
</tbody></table>
<h2>Console Eval команды</h2>
<p>Полный список — <a href="/help/js_console">JS Console</a>.</p>
<h2>Help уровни</h2>
<table><thead><tr><th>Level</th><th>Что</th></tr></thead><tbody>
<tr><td><code>?</code></td><td>Quick (5-7 команд, auto-shown on load)</td></tr>
<tr><td><code>??</code></td><td>Cheatsheet (все команды, без примеров)</td></tr>
<tr><td><code>???</code></td><td>Full (examples + navigation)</td></tr>
<tr><td><code>help()</code></td><td>= ?</td></tr>
</tbody></table>
