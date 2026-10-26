---
title: "Тесты"
weight: 90
bookToc: false
---

<h1>✅ Тесты (140)</h1>
<h2>Структура</h2>
<table><thead><tr><th>Сьют</th><th>Кол-во</th><th>Что</th></tr></thead><tbody>
<tr><td>mtapi/*.test.js</td><td>118</td><td>app.js, debug, network, logcat, perf, jsdom, eslint</td></tr>
<tr><td>universal: dom</td><td>6</td><td>jsdom, getElementById, addEventListener</td></tr>
<tr><td>universal: braces</td><td>6</td><td>баланс скобок, no triple <code>});</code></td></tr>
<tr><td>universal: syntax</td><td>6</td><td>no SyntaxError, loads in jsdom</td></tr>
<tr><td>universal: node</td><td>4</td><td>require() in Node, no top-level document</td></tr>
</tbody></table>
<h2>Команды</h2>
<table><tbody>
<tr><td><code onclick="copy(this)">make test</code></td><td>Все 140 (33с)</td></tr>
<tr><td><code onclick="copy(this)">bash test/run-all.sh</code></td><td>Все (33с, с --test-force-exit)</td></tr>
<tr><td><code onclick="copy(this)">node --test test/mtapi-debug-v2.test.js</code></td><td>Один файл</td></tr>
</tbody></table>
<h2>CI</h2>
<p>GitHub Actions: <code>.github/workflows/ci.yml</code>. Go (build/vet/test/gofmt) + JS tests (140). Timeout: go 10, js-tests 20.</p>
<p>Предыдущий баг: <code>run-all.sh</code> без <code>--test-force-exit</code> → hang 20+ мин (setInterval в attach()). Фикс: 33с.</p>
