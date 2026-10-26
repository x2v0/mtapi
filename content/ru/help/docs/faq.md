---
title: "FAQ"
weight: 100
bookToc: false
---

<h1>❓ FAQ</h1>
<h2>Почему fetch не работает в iframe?</h2>
<p>CORS: iframe на другом origin → <code>contentDocument</code> = null, <code>fetch</code> блокируется. Решение: <a href="/proxy/PORT/">/proxy/PORT/</a> (same-origin) или <a href="/proxy-url">/proxy-url</a>.</p>
<h2>Почему google.com не загружается в iframe?</h2>
<p><code>X-Frame-Options: SAMEORIGIN</code>. Решение: <code>/proxy-url?url=https://google.com</code> (strips header) или <code>Android.httpGet</code> (Java).</p>
<h2>Почему DuckDuckGo в браузере?</h2>
<p>Default — <code>/help</code> (TOC). Можно сменить: <code>_browserNavigate("https://...")</code>.</p>
<h2>Почему DNS fail в Go (JNI)?</h2>
<p>Go в JNI наследует DNS от Java/WebView (<code>[::1]:53</code>). В Android — нет <code>/etc/resolv.conf</code>. Решение: <code>Android.httpGet</code> (Java DNS) вместо Go <code>http.Get</code>.</p>
<h2>Почему logcat пустой?</h2>
<p>Android 11+ SELinux: logcat для untrusted_app ограничен. Только <code>adb logcat</code> (ПК) или root.</p>
<h2>Как отключить тему?</h2>
<p><code>localStorage.setItem("mtapi-theme", "light")</code> или <code>"dark"</code>.</p>
<h2>Как сменить порт?</h2>
<p>Порт 7788 фиксирован (Go). Можно <code>/proxy/PORT/</code> для localhost-портов.</p>
<h2>Как добавить endpoint?</h2>
<p>В <code>gocore/cmd/mtapi-server/api.go</code> + <code>http.go</code> (<code>mux.HandleFunc("/"+m, ...)</code>).</p>
