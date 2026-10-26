---
title: "Browser"
weight: 50
bookToc: false
---

<h1>🌐 Browser overlay</h1>
<p>Кнопка ⚙️ в header mtapi → iframe + toolbar. Default: <code>/help</code>.</p>
<h2>Toolbar</h2>
<table><thead><tr><th>Кнопка</th><th>Что</th></tr></thead><tbody>
<tr><td>⚙️</td><td>Back to MTAPI (закрыть browser)</td></tr>
<tr><td>←</td><td>Назад (история)</td></tr>
<tr><td>[url]</td><td>Input (Enter → navigate)</td></tr>
<tr><td>→</td><td>Вперёд</td></tr>
<tr><td>↻</td><td>Reload</td></tr>
<tr><td>🐞</td><td>Debug (наш overlay)</td></tr>
</tbody></table>
<h2>Загрузка страниц</h2>
<table><thead><tr><th>Метод</th><th>Что</th><th>Работает</th></tr></thead><tbody>
<tr><td>Android.httpGet</td><td>Java DNS, no CORS, no X-Frame-Options</td><td>любой сайт</td></tr>
<tr><td>/proxy-url?url=...</td><td>Go fetch, strips X-Frame-Options</td><td>любой сайт (HTML)</td></tr>
<tr><td>fetch → srcdoc</td><td>JS fetch → iframe srcdoc</td><td>CORS-friendly</td></tr>
<tr><td>iframe.src</td><td>Прямая загрузка</td><td>X-Frame-friendly</td></tr>
</tbody></table>
<h2>Reverse proxy</h2>
<p><code>/proxy/PORT/*</code> → <code>localhost:PORT/*</code> (whitelist: 5555, 3000, 8080). Same-origin → полный debug.</p>
<p><code>/proxy-url?url=...</code> → fetch URL → HTML (strips X-Frame-Options, injects base + nav).</p>
<h2>Android.httpGet</h2>
<p>Java bridge: <code>HttpURLConnection</code> — работает без CORS, обходит X-Frame-Options. Default для внешних URL.</p>
