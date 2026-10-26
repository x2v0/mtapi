---
title: "Сборка"
weight: 80
bookToc: false
---

<h1>🔨 Сборка</h1>
<h2>Требования</h2>
<ul>
<li>Termux (Android)</li>
<li>Go 1.22+ (для .so)</li>
<li>Node 22+ (для тестов)</li>
<li>wta (для APK, из <code>~/w2a</code>)</li>
</ul>
<h2>Команды</h2>
<table><thead><tr><th>Команда</th><th>Что</th><th>Время</th></tr></thead><tbody>
<tr><td><code onclick="copy(this)">make so</code></td><td>Собрать .so (Go)</td><td>10с</td></tr>
<tr><td><code onclick="copy(this)">make test</code></td><td>140 тестов</td><td>33с</td></tr>
<tr><td><code onclick="copy(this)">make apk</code></td><td>Test + .so + APK</td><td>~75с</td></tr>
<tr><td><code onclick="copy(this)">make apk-fast</code></td><td>.so + APK (без тестов)</td><td>~35с</td></tr>
<tr><td><code onclick="copy(this)">make install</code></td><td>Собрать + установить</td><td>~75с</td></tr>
<tr><td><code onclick="copy(this)">make dump</code></td><td>Инспекция APK</td><td>5с</td></tr>
</tbody></table>
<h2>wta (APK без Gradle)</h2>
<p>APK собирается через <a href="https://github.com/x2v0/w2a">wta</a> — YAML → APK на телефоне. Без Android SDK.</p>
<h2>CI</h2>
<p>GitHub Actions (ubuntu-latest): Go (build/vet/test/gofmt) + JS tests (140). Timeout: 10/20 мин.</p>
