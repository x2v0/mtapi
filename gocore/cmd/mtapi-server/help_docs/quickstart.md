---
title: "Быстрый старт"
weight: 10
bookToc: false
---

<h1>📖 Быстрый старт</h1>
<h2>Что такое mtapi</h2>
<p>mtapi — HTTP-сервер (Go) внутри Android APK. WebView загружает <code>http://127.0.0.1:7788</code>, JS вызывает <code>fetch('/battery')</code> → Go → JNI → Android API → JSON. Без Termux, Shizuku, root.</p>
<h2>Установка</h2>
<div class="step">1. Скачай APK: <a href="/help/build">release</a></div>
<div class="step">2. Установи (разреши «неизвестные источники»)</div>
<div class="step">3. Открой mtapi — WebView загрузит dashboard</div>
<h2>Первый запрос</h2>
<p>В Console Eval (FAB 🐞 → Console) введи:</p>
<table><tbody>
<tr><td><code onclick="copy(this)">fetch("/battery").then(r => r.json()).then(j => log(j))</code></td></tr>
</tbody></table>
<p>Результат — в JS Logs + Network tab.</p>
<h2>Debug overlay</h2>
<p>FAB 🐞 → overlay с 7 табами: <a href="/help/debug">Debug</a>.</p>
<h2>Browser overlay</h2>
<p>⚙️ в header → iframe + proxy: <a href="/help/browser">Browser</a>.</p>
<h2>Console (web, 5 табов)</h2>
<p><code>/console</code> — веб-консоль в браузере (открывается в URL input):</p>
<ul>
<li><b>Console</b> — JS eval с <code>await</code> (fetch любой endpoint)</li>
<li><b>Logs</b> — JS логи</li>
<li><b>Errors</b> — persistent errors</li>
<li><b>Logcat</b> — Android logcat</li>
<li><b>System</b> — CPU, RAM, storage</li>
</ul>
<p>Открыть: в browser введи <code>/console</code> (или полный <code>http://127.0.0.1:7788/console</code>).</p>
<p class="hint">Совет: <code>/help</code> — документация (эта страница), <code>/console</code> — интерактивная консоль с 5 табами.</p>

<h2>Дальше</h2>
<ul>
<li><a href="/help/api">API endpoints (60+)</a></li>
<li><a href="/help/js_console">JS Console (все команды)</a></li>
<li><a href="/help/architecture">Архитектура</a></li>
</ul>
