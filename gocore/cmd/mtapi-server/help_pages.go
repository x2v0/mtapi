package main

import "net/http"

// ── /help/quickstart ──
func (s *apiServer) helpQuickstartHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>📖 Быстрый старт</h1>
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
<h2>Дальше</h2>
<ul>
<li><a href="/help/api">API endpoints (60+)</a></li>
<li><a href="/help/js_console">JS Console (все команды)</a></li>
<li><a href="/help/architecture">Архитектура</a></li>
</ul>`
	helpRender(w, "Quickstart", "quickstart", body)
}

// ── /help/api ──
func (s *apiServer) helpAPIHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>🔌 API endpoints (60+)</h1>
<p class="hint">Все — GET, JSON. Вызов: fetch("/endpoint").then(r => r.json()).then(j => log(j))</p>`

	cats := []struct {
		Name string
		Eps  [][2]string
	}{
		{"Basic (16)", [][2]string{
			{"/ping", "pong"}, {"/battery", "level, charging"},
			{"/wifi", "ssid, rssi"}, {"/device", "model, sdk"},
			{"/location", "lat, lon"}, {"/clipboard", "text"},
			{"/clipboard?op=set&text=hello", "set clipboard"},
			{"/toast?text=hello", "show toast"},
			{"/notify?title=Hi&body=There", "notification"},
			{"/vibrate?ms=200", "vibrate"},
			{"/torch?on=1", "flashlight on"}, {"/torch?on=0", "off"},
			{"/torch/brightness?level=50", "set brightness"},
			{"/torch/brightness?level=0", "reset"},
			{"/tts?text=hello", "text-to-speech"},
			{"/share?title=Hi&text=There", "share intent"},
		}},
		{"Contacts / SMS (3)", [][2]string{
			{"/contacts?limit=0", "contacts (0=all)"},
			{"/calllog?limit=0", "call log"},
			{"/sms?limit=0", "SMS"},
		}},
		{"System (6)", [][2]string{
			{"/system", "device info"}, {"/cpu/detail", "CPU cores"},
			{"/thermal", "temperatures"}, {"/memory", "RAM"},
			{"/storage", "disks"}, {"/kernel", "kernel version"},
		}},
		{"Network (8)", [][2]string{
			{"/network", "connectivity"}, {"/wifi/detailed", "WiFi detail"},
			{"/bluetooth", "BT state"}, {"/telephony", "SIM/carrier"},
			{"/wifi/scan", "WiFi scan"},
			{"/net/ping?host=8.8.8.8&count=3", "ping"},
			{"/net/dns?host=example.com", "DNS"},
			{"/net/fetch?url=https%3A%2F%2Fapi.ipify.org%3Fformat%3Djson", "fetch URL"},
		}},
		{"Display / Audio (7)", [][2]string{
			{"/display", "screen info"}, {"/display/brightness", "brightness"},
			{"/display/color", "color mode"}, {"/audio", "volume levels"},
			{"/microphone", "mic state"}, {"/audio/volume?stream=2", "set volume"},
			{"/audio/ringer", "ringer mode"},
		}},
		{"Sensors (4)", [][2]string{
			{"/sensors", "list"}, {"/sensors/read?name=accelerometer&ms=200", "read"},
			{"/sensors/stream?name=accelerometer&hz=10", "stream"},
			{"/sensors/stream/stop?name=accelerometer", "stop"},
		}},
		{"Hardware (4)", [][2]string{
			{"/features", "hw features"}, {"/camera/list", "cameras"},
			{"/camera/snapshot", "snapshot"}, {"/microphone/record?seconds=3", "record"},
		}},
		{"Apps (2)", [][2]string{
			{"/app/list", "installed apps"},
			{"/app/launch?pkg=com.android.settings", "launch app"},
		}},
		{"Detailed (5)", [][2]string{
			{"/battery/detailed", "battery detail"}, {"/location/detailed", "location detail"},
			{"/locale", "locale"}, {"/calendar?days=7", "calendar"},
			{"/alarm/next", "next alarm"},
		}},
		{"Files / Audio play (5)", [][2]string{
			{"/files/save?name=test.txt&data=hello", "save file"},
			{"/audio/play?uri=/system/media/audio/notifications/Hello.ogg", "play"},
			{"/audio/play/stop", "stop"}, {"/tts/voices", "TTS voices"},
			{"/tts/stop", "stop TTS"},
		}},
		{"Watch (4)", [][2]string{
			{"/clipboard/watch?hz=2", "watch clipboard"},
			{"/clipboard/watch/stop", "stop"},
			{"/location/watch?hz=1", "watch location"},
			{"/location/watch/stop", "stop"},
		}},
	}

	for _, c := range cats {
		body += `<h2>` + c.Name + `</h2><table><thead><tr><th>Endpoint</th><th>Returns</th><th>Copy</th></tr></thead><tbody>`
		for _, ep := range c.Eps {
			cmd := `fetch("` + ep[0] + `").then(r => r.json()).then(j => log(j))`
			body += `<tr><td><code>` + htmlEscape(ep[0]) + `</code></td><td class="desc">` + htmlEscape(ep[1]) + `</td><td><button onclick="copy(this.closest('tr').querySelector('code'))">📋</button></td></tr>`
			_ = cmd
		}
		body += `</tbody></table>`
	}
	helpRender(w, "API", "api", body)
}

// ── /help/debug ──
func (s *apiServer) helpDebugHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>🐞 Debug overlay (7 табов)</h1>
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
</tbody></table>`
	helpRender(w, "Debug", "debug", body)
}

// ── /help/dom ──
func (s *apiServer) helpDOMHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>🌳 DOM floating</h1>
<p>Кнопка 🌳 в Console Eval → floating окно (DOM tree + info panel).</p>
<h2>Возможности</h2>
<table><thead><tr><th>Feature</th><th>Как</th></tr></thead><tbody>
<tr><td>Select element</td><td><code>domInspect()</code> → клик по странице → info</td></tr>
<tr><td>Root toggle</td><td>▣ (overlay) / 🌐 (page) — auto при открытии/закрытии debug</td></tr>
<tr><td>Auto-refresh</td><td>3с (skip если не изменилось, save open+scroll)</td></tr>
<tr><td>8-edge resize</td><td>Тянуть любой край/угол (n/s/e/w + 4 corners)</td></tr>
<tr><td>Splitter</td><td>⋮⋮ между tree и info (dblclick — reset)</td></tr>
<tr><td>Minimize</td><td>– (свернуть до header)</td></tr>
<tr><td>Drag</td><td>Header (mouse + touch)</td></tr>
<tr><td>Select U+25A3</td><td>▣ (toggle, magenta когда ON)</td></tr>
<tr><td>Copy HTML</td><td>📋 (outerHTML → clipboard, toast)</td></tr>
<tr><td>AI Snap</td><td>✨ (markdown: selector, HTML, CSS 24, parent, children, task)</td></tr>
</tbody></table>
<h2>DOM tree</h2>
<p>Клик по <code>&lt;summary&gt;</code> — toggle. data-tag на каждом узле. Клик по узлу (inspect ON) — подсветка в дереве.</p>`
	helpRender(w, "DOM floating", "dom", body)
}

// ── /help/browser ──
func (s *apiServer) helpBrowserHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>🌐 Browser overlay</h1>
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
<p>Java bridge: <code>HttpURLConnection</code> — работает без CORS, обходит X-Frame-Options. Default для внешних URL.</p>`
	helpRender(w, "Browser", "browser", body)
}

// ── /help/native ──
func (s *apiServer) helpNativeHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>📱 Native bridge (Android)</h1>
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
</ul>`
	helpRender(w, "Native", "native", body)
}

// ── /help/architecture ──
func (s *apiServer) helpArchitectureHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>🏗️ Архитектура</h1>
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
<div class="step">→ JSON → JS → render</div>`
	helpRender(w, "Архитектура", "architecture", body)
}

// ── /help/build ──
func (s *apiServer) helpBuildHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>🔨 Сборка</h1>
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
<p>GitHub Actions (ubuntu-latest): Go (build/vet/test/gofmt) + JS tests (140). Timeout: 10/20 мин.</p>`
	helpRender(w, "Сборка", "build", body)
}

// ── /help/tests ──
func (s *apiServer) helpTestsHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>✅ Тесты (140)</h1>
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
<p>Предыдущий баг: <code>run-all.sh</code> без <code>--test-force-exit</code> → hang 20+ мин (setInterval в attach()). Фикс: 33с.</p>`
	helpRender(w, "Тесты", "tests", body)
}

// ── /help/faq ──
func (s *apiServer) helpFAQHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>❓ FAQ</h1>
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
<p>В <code>gocore/cmd/mtapi-server/api.go</code> + <code>http.go</code> (<code>mux.HandleFunc("/"+m, ...)</code>).</p>`
	helpRender(w, "FAQ", "faq", body)
}

// htmlEscape — simple escape (avoid import cycle)
func htmlEscape(s string) string {
	r := ""
	for _, c := range s {
		switch c {
		case '<':
			r += "&lt;"
		case '>':
			r += "&gt;"
		case '&':
			r += "&amp;"
		case '"':
			r += "&quot;"
		default:
			r += string(c)
		}
	}
	return r
}
