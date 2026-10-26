---
title: "Архитектура"
weight: 70
bookToc: false
---

<h1>🏗️ Архитектура</h1>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:11px;line-height:1.4;overflow:auto">┌─────────────────────────────────────┐
│  Android (телефон)                   │
│  ┌───────────────────────────────┐  │
│  │  mtapi APK (MainActivity)     │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  WebView (WebViewClient)│  │  │
│  │  │  ← HTML/CSS/JS (UI)     │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Go HTTP server (:7788) │  │  │
│  │  │  ← /battery, /camera... │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  JNI bridge (Go↔Java)   │  │  │
│  │  │  ← Android.* API        │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘</pre>
<h2>Компоненты</h2>
<table><thead><tr><th>Файл</th><th>Язык</th><th>Что</th></tr></thead><tbody>
<tr><td><code>libmtapi-server.so</code></td><td>Go</td><td>HTTP-сервер (60+ endpoints), proxy, help</td></tr>
<tr><td><code>mtapi-debug.js</code></td><td>JS</td><td>Debug overlay, browser, DOM floating, Console</td></tr>
<tr><td><code>app.js</code></td><td>JS</td><td>Main UI (endpoints, render, search)</td></tr>
<tr><td><code>MainActivity.java</code></td><td>Java</td><td>WebView, JNI bridge, Android.*</td></tr>
<tr><td><code>index.html</code></td><td>HTML</td><td>WebView UI</td></tr>
<tr><td><code>style.css</code></td><td>CSS</td><td>UI (тема, dark/light)</td></tr>
</tbody></table>
<h2>Flow</h2>
<div class="step">JS (WebView) → fetch('/battery')</div>
<div class="step">→ Go HTTP (:7788) → JNI → Java → Android API</div>
<div class="step">→ JSON → JS → render</div>
