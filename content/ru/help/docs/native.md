---
title: "Native bridge"
weight: 60
bookToc: false
---

<h1>📱 Native bridge (Android)</h1>
<p>JS-объект <code>Android.*</code> — JNI-мост в Java (MainActivity).</p>
<h2>Методы</h2>
<table><thead><tr><th>Метод</th><th>Что</th><th>Copy</th></tr></thead><tbody>
<tr><td><code>Android.getLogcat(n)</code></td><td>logcat (n строк)</td><td><button onclick="copy(this.closest('tr').querySelector('code'))">📋</button></td></tr>
<tr><td><code>Android.processList()</code></td><td>running processes</td><td><button onclick="copy(this.closest('tr').querySelector('code'))">📋</button></td></tr>
<tr><td><code>Android.getDeviceInfo()</code></td><td>device info</td><td><button onclick="copy(this.closest('tr').querySelector('code'))">📋</button></td></tr>
<tr><td><code>Android.httpGet(url)</code></td><td>HTTP GET (Java DNS, no CORS)</td><td><button onclick="copy(this.closest('tr').querySelector('code'))">📋</button></td></tr>
</tbody></table>
<h2>Примеры</h2>
<table><tbody>
<tr><td><code onclick="copy(this)">Android.getLogcat(20)</code></td></tr>
<tr><td><code onclick="copy(this)">Android.processList()</code></td></tr>
<tr><td><code onclick="copy(this)">Android.httpGet("https://html.duckduckgo.com/html/")</code></td></tr>
</tbody></table>
<h2>Ограничения</h2>
<ul>
<li>Android 11+: logcat для untrusted_app ограничен (SELinux) → <code>Android.getLogcat()</code> может вернуть пусто</li>
<li>httpGet: таймаут 10с, лимит 5MB</li>
</ul>
