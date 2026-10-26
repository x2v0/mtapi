package main

import (
	"net/http"
)

const helpCSS = `
body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fafafa;color:#1a1a1a;margin:0;padding:16px;font-size:13px;line-height:1.5}
h1{color:#0288d1;font-size:20px;margin:0 0 4px}
h2{color:#0288d1;font-size:15px;margin:24px 0 8px;border-bottom:2px solid #e3f2fd;padding-bottom:4px}
h3{color:#555;font-size:13px;margin:16px 0 6px}
p{margin:4px 0 8px}
a{color:#0288d1;text-decoration:none}
a:hover{text-decoration:underline}
table{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 8px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#e3f2fd;color:#555;font-weight:600}
td code{background:#f5f5f5;color:#c2185b;padding:2px 6px;border-radius:3px;display:block;white-space:pre-wrap;word-break:break-all;user-select:all;cursor:pointer;font-family:inherit;font-size:11px}
td code:hover{background:#ffe0e0}
td.desc{color:#666}
.nav{background:#fff;padding:8px 12px;border-radius:4px;margin:0 0 16px;border:1px solid #e0e0e0}
.nav a{margin-right:14px}
.toc{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px 16px;margin:16px 0}
.toc ul{list-style:none;padding:0;margin:0}
.toc li{margin:6px 0}
.toc li a{font-weight:600}
.toc li .desc{color:#888;font-size:11px;margin-left:8px}
.hint{color:#888;font-size:11px;margin:0 0 12px}
.badge{display:inline-block;background:#0288d1;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;margin-left:6px}
.step{background:#e3f2fd;border-left:3px solid #0288d1;padding:6px 10px;margin:6px 0;font-size:12px}
`

func helpRender(w http.ResponseWriter, title, active, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	html := `<!DOCTYPE html><html><head><meta charset="utf-8"><title>mtapi — ` + title + `</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>` + helpCSS + `</style></head><body>`
	html += `<div class="nav"><a href="/help">🏠 Оглавление</a><a href="/help/quickstart">📖 Quickstart</a><a href="/help/js_console">🖥️ JS Console</a><a href="/help/api">🔌 API</a><a href="/help/debug">🐞 Debug</a><a href="/help/dom">🌳 DOM</a><a href="/help/browser">🌐 Browser</a><a href="/help/native">📱 Native</a><a href="/help/architecture">🏗️ Arch</a><a href="/help/build">🔨 Build</a><a href="/help/tests">✅ Tests</a><a href="/help/faq">❓ FAQ</a></div>`
	html += body
	html += `<p class="hint" style="margin-top:24px">mtapi · terminal API для Android · <a href="https://github.com/x2v0/mtapi">github</a></p>`
	html += `<script>function copy(el){var t=el.textContent||el.innerText;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast('Copied: '+t.slice(0,50))})}else{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('Copied')}}function toast(m){var t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0288d1;color:#fff;padding:8px 16px;border-radius:4px;font-family:monospace;font-size:12px;z-index:9999;transition:opacity 0.2s';document.body.appendChild(t)}t.textContent=m;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity='0'},2000)}
document.addEventListener('click',function(e){if(e.target&&e.target.tagName==='CODE'){e.preventDefault();copy(e.target)}});
</script>`
	html += `</body></html>`
	w.Write([]byte(html))
}

func helpItoa(i int) string {
	if i == 0 {
		return "0"
	}
	var s string
	for i > 0 {
		s = string(rune('0'+i%10)) + s
		i /= 10
	}
	return s
}

func (s *apiServer) helpIndexHandler(w http.ResponseWriter, r *http.Request) {
	body := `<h1>mtapi — документация</h1><p class="hint">terminal API для Android · <span class="badge">v2.13.0</span></p><div class="toc-tree">`

	body += `<details open><summary>📖 Быстрый старт</summary><ul>`
	body += `<li><a href="/help/quickstart#what">Что такое mtapi</a></li>`
	body += `<li><a href="/help/quickstart#install">Установка</a></li>`
	body += `<li><a href="/help/quickstart#first">Первый запрос</a></li>`
	body += `<li><a href="/help/quickstart#debug">Debug overlay</a></li>`
	body += `<li><a href="/help/quickstart#browser">Browser overlay</a></li>`
	body += `</ul></details>`

	body += `<details open><summary>🖥️ JS Console</summary><ul>`
	body += `<li><a href="/help/js_console#cat-0">DOM query</a></li>`
	body += `<li><a href="/help/js_console#cat-1">Inspect / Select</a></li>`
	body += `<li><a href="/help/js_console#cat-2">JS Logs</a></li>`
	body += `<li><a href="/help/js_console#cat-3">Debug tabs</a></li>`
	body += `<li><a href="/help/js_console#cat-4">Perf</a></li>`
	body += `<li><a href="/help/js_console#cat-5">Network (logged)</a></li>`
	body += `<li><a href="/help/js_console#cat-6">Native (APK)</a></li>`
	body += `<li><a href="/help/js_console#cat-7">Browser overlay</a></li>`
	body += `<li><a href="/help/js_console#cat-8">AI Snap</a></li>`
	body += `<li><a href="/help/js_console#cat-9">Help levels</a></li>`
	body += `</ul></details>`

	body += `<details open><summary>🔌 API endpoints (60+)</summary><ul>`
	body += `<li><a href="/help/api#basic">Basic (16)</a></li>`
	body += `<li><a href="/help/api#contacts">Contacts / SMS (3)</a></li>`
	body += `<li><a href="/help/api#system">System (6)</a></li>`
	body += `<li><a href="/help/api#network">Network (8)</a></li>`
	body += `<li><a href="/help/api#display">Display / Audio (7)</a></li>`
	body += `<li><a href="/help/api#sensors">Sensors (4)</a></li>`
	body += `<li><a href="/help/api#hardware">Hardware (4)</a></li>`
	body += `<li><a href="/help/api#apps">Apps (2)</a></li>`
	body += `<li><a href="/help/api#detailed">Detailed (5)</a></li>`
	body += `<li><a href="/help/api#files">Files / Audio play (5)</a></li>`
	body += `<li><a href="/help/api#watch">Watch (4)</a></li>`
	body += `</ul></details>`

	body += `<details open><summary>🐞 Debug overlay (7 табов)</summary><ul>`
	body += `<li><a href="/help/debug#logs">Logs</a></li>`
	body += `<li><a href="/help/debug#console">Console</a></li>`
	body += `<li><a href="/help/debug#errors">Errors</a></li>`
	body += `<li><a href="/help/debug#logcat">Logcat</a></li>`
	body += `<li><a href="/help/debug#devtools">DevTools</a></li>`
	body += `<li><a href="/help/debug#system">System</a></li>`
	body += `<li><a href="/help/debug#network">Network</a></li>`
	body += `</ul></details>`

	body += `<details open><summary>🌳 DOM floating</summary><ul>`
	body += `<li><a href="/help/dom#select">Select element</a></li>`
	body += `<li><a href="/help/dom#root">Root toggle</a></li>`
	body += `<li><a href="/help/dom#refresh">Auto-refresh</a></li>`
	body += `<li><a href="/help/dom#resize">8-edge resize</a></li>`
	body += `<li><a href="/help/dom#splitter">Splitter</a></li>`
	body += `<li><a href="/help/dom#ai">AI Snap</a></li>`
	body += `</ul></details>`

	body += `<details open><summary>🌐 Browser overlay</summary><ul>`
	body += `<li><a href="/help/browser#toolbar">Toolbar</a></li>`
	body += `<li><a href="/help/browser#load">Загрузка страниц</a></li>`
	body += `<li><a href="/help/browser#proxy">Reverse proxy</a></li>`
	body += `<li><a href="/help/browser#httpget">Android.httpGet</a></li>`
	body += `</ul></details>`

	body += `<details><summary>📱 Native bridge</summary><ul>`
	body += `<li><a href="/help/native#logcat">Android.getLogcat</a></li>`
	body += `<li><a href="/help/native#process">Android.processList</a></li>`
	body += `<li><a href="/help/native#httpget">Android.httpGet</a></li>`
	body += `</ul></details>`

	body += `<details><summary>🏗️ Архитектура</summary><ul>`
	body += `<li><a href="/help/architecture#diagram">Диаграмма</a></li>`
	body += `<li><a href="/help/architecture#components">Компоненты</a></li>`
	body += `<li><a href="/help/architecture#flow">Flow</a></li>`
	body += `</ul></details>`

	body += `<details><summary>🔨 Сборка</summary><ul>`
	body += `<li><a href="/help/build#requirements">Требования</a></li>`
	body += `<li><a href="/help/build#commands">Команды</a></li>`
	body += `<li><a href="/help/build#wta">wta (APK)</a></li>`
	body += `<li><a href="/help/build#ci">CI</a></li>`
	body += `</ul></details>`

	body += `<details><summary>✅ Тесты (140)</summary><ul>`
	body += `<li><a href="/help/tests#structure">Структура</a></li>`
	body += `<li><a href="/help/tests#commands">Команды</a></li>`
	body += `<li><a href="/help/tests#ci">CI</a></li>`
	body += `</ul></details>`

	body += `<details><summary>❓ FAQ</summary><ul>`
	body += `<li><a href="/help/faq#cors">CORS в iframe</a></li>`
	body += `<li><a href="/help/faq#xframe">google.com в iframe</a></li>`
	body += `<li><a href="/help/faq#dns">DNS fail в Go</a></li>`
	body += `<li><a href="/help/faq#logcat">logcat пустой</a></li>`
	body += `</ul></details>`

	body += `</div>`
	helpRender(w, "документация", "", body)
}

// ── /help/js_console ──
func (s *apiServer) helpJSConsoleHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("js_console")
	helpRender(w, title, "js_console", body)
}
