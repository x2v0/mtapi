package main

import (
	"fmt"
	"net/http"
)

const pagesCSS = `body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fafafa;color:#1a1a1a;margin:0;padding:12px;font-size:12px;line-height:1.4}h1{color:#0288d1;font-size:16px;margin:0 0 8px}h2{color:#0288d1;font-size:13px;margin:12px 0 4px}.tabs{display:flex;gap:4px;overflow-x:auto;padding:6px 0;border-bottom:1px solid #e0e0e0;margin-bottom:12px}.tabs a{padding:4px 10px;background:#fff;border:1px solid #e0e0e0;border-radius:4px;color:#555;text-decoration:none;white-space:nowrap;font-size:11px}.tabs a.active{background:#0288d1;color:#fff;border-color:#0288d1}.tabs a:hover{background:#e3f2fd}.bar{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}button{background:#0288d1;color:#fff;border:none;border-radius:4px;padding:5px 12px;font-family:monospace;font-size:11px;cursor:pointer}button:hover{background:#0277bd}button.g{background:#e0e0e0;color:#1a1a1a}button.g:hover{background:#d0d0d0}pre{background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:8px;margin:0;white-space:pre-wrap;word-break:break-all;overflow:auto;max-height:75vh;font-size:11px}table{width:100%;border-collapse:collapse;background:#fff;font-size:11px}th,td{border:1px solid #e0e0e0;padding:3px 6px;text-align:left;vertical-align:top}th{background:#e3f2fd;color:#555;position:sticky;top:0}.hint{color:#888;font-size:11px;margin:4px 0}.err{color:#c00;background:#fff3f3;border:1px solid #fcc;padding:8px;border-radius:4px}.lvl-e{color:#c00}.lvl-w{color:#e67e22}.lvl-v{color:#888}.spin{display:inline-block;width:12px;height:12px;border:2px solid #e0e0e0;border-top-color:#0288d1;border-radius:50%;animation:mtapi-spin 0.8s linear infinite;vertical-align:middle}@keyframes mtapi-spin{to{transform:rotate(360deg)}}`

func pageLayout(title, active, token, body string) string {
	nav := `<div class="tabs">`
	tabs := [][2]string{
		{"/logs", "Logs"}, {"/console", "Console"}, {"/errors", "Errors"},
		{"/logcat", "Logcat"}, {"/devtools", "DevTools"}, {"/sys", "System"}, {"/net", "Net"},
	}
	for _, it := range tabs {
		cls := ""
		if it[0] == active {
			cls = ` class="active"`
		}
		nav += `<a href="` + it[0] + `?token=` + token + `"` + cls + `>` + it[1] + `</a>`
	}
	nav += `</div>`

	script := `<script>
var TOKEN = ` + fmt.Sprintf("%q", token) + `;
var _f = window.fetch;
window.fetch = function(u, o) {
  try { if (typeof u === 'string' && u.charAt(0)==='/' && u.indexOf('token=')<0) u += (u.indexOf('?')>=0?'&':'?') + 'token=' + TOKEN; } catch(e){}
  return _f.call(window, u, o);
};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function setHtml(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h}
function tableHtml(rows,cols){var h='<table><thead><tr>';cols.forEach(function(c){h+='<th>'+esc(c)+'</th>'});h+='</tr></thead><tbody>';rows.forEach(function(r){h+='<tr>';r.forEach(function(c){h+='<td>'+c+'</td>'});h+='</tr>'});h+='</tbody></table>';return h}
function copyId(id){var el=document.getElementById(id);if(!el)return;var t=el.textContent||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){alert('Copied '+t.length+' chars')})}else{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)}}
function renderJSON(o){if(o===null||o===undefined)return '<span style="color:#888">'+String(o)+'</span>';if(typeof o!=='object')return '<span>'+esc(String(o))+'</span>';if(Array.isArray(o)){if(!o.length)return '<span style="color:#888">(empty)</span>';if(typeof o[0]!=='object'){return '<table><tbody>'+o.map(function(v){return '<tr><td>'+esc(String(v))+'</td></tr>'}).join('')+'</tbody></table>';}var keys={};o.forEach(function(it){Object.keys(it).forEach(function(k){keys[k]=1})});var cols=Object.keys(keys);var h='<table><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>';o.forEach(function(it){h+='<tr>'+cols.map(function(c){return '<td>'+renderJSON(it[c])+'</td>'}).join('')+'</tr>'});return h+'</tbody></table>';}var keys=Object.keys(o);if(!keys.length)return '<span style="color:#888">{}</span>';var h='<table><tbody>';keys.forEach(function(k){var v=o[k];if(v!==null&&typeof v==='object'){h+='<tr><td style="color:#888;width:180px;vertical-align:top">'+esc(k)+'</td><td>'+renderJSON(v)+'</td></tr>'}else{h+='<tr><td style="color:#888;width:180px">'+esc(k)+'</td><td>'+esc(String(v))+'</td></tr>'}});return h+'</tbody></table>'}
</script>`

	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>mtapi — ` + title + `</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>` + pagesCSS + `</style></head><body>` + nav + script + body + `</body></html>`
}

func (s *apiServer) logsPageHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	body := `<h1>JS Logs</h1>
<div class="bar"><button onclick="load()">↻ Refresh</button><button class="g" onclick="copyId('out')">📋 Copy</button></div>
<p class="hint">JS logs from WebView memory. External browser: not available.</p>
<div id="out"><span class="spin"></span></div>
<script>
function load(){
  var buf=[];
  try{ if(window.parent&&window.parent.MtapiDebug&&window.parent.MtapiDebug.buffer) buf=window.parent.MtapiDebug.buffer(); }catch(e){}
  if(!buf||!buf.length){
    setHtml('out','<div class="err">Not available from external browser. JS logs live in WebView memory.<br>Open in mtapi (FAB 🐞 → Logs) or in iframe from browser.</div>');
    return;
  }
  var rows=buf.slice().reverse().map(function(e){
    var t=''; try{t=new Date(e.t).toLocaleTimeString()}catch(x){}
    var lvl=(e.lvl||'log').toLowerCase();
    var cls='lvl-'+(lvl==='error'?'e':lvl==='warn'?'w':'v');
    return [esc(t),'<span class="'+cls+'">'+esc((e.lvl||'log').toUpperCase())+'</span>',esc(e.m)];
  });
  setHtml('out',tableHtml(rows,['Time','L','Message']));
}
load();
if(TOKEN) setInterval(load,2000);
</script>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, pageLayout("Logs", "/logs", token, body))
}

func (s *apiServer) errorsPageHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	body := `<h1>Errors (persistent)</h1>
<div class="bar"><button onclick="load()">↻ Refresh</button><button class="g" onclick="copyId('out')">📋 Copy</button></div>
<p class="hint">Persistent errors (localStorage, shared across same origin). Works everywhere.</p>
<div id="out"><span class="spin"></span></div>
<script>
function load(){
  var er=[];
  try{ er=JSON.parse(localStorage.getItem('mtapi-errors')||'[]'); }catch(e){}
  if(!er.length){ setHtml('out','<p class="hint">(no errors)</p>'); return; }
  var rows=er.map(function(x){
    var t=''; try{t=new Date(x.t).toLocaleTimeString()}catch(e){}
    return [esc(t),'<span class="lvl-e">E</span>',esc(x.m)];
  });
  setHtml('out',tableHtml(rows,['Time','L','Error']));
}
load();
if(TOKEN) setInterval(load,3000);
</script>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, pageLayout("Errors", "/errors", token, body))
}

func (s *apiServer) logcatPageHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	body := `<h1>Logcat</h1>
<div class="bar"><button onclick="load()">↻ Refresh</button><button class="g" onclick="copyId('out')">📋 Copy</button></div>
<p class="hint">Logcat via Android bridge (parent.Android.getLogcat). External browser: not available.</p>
<div id="out"><span class="spin"></span></div>
<script>
function load(){
  var log='';
  try{ if(window.parent&&window.parent.Android&&window.parent.Android.getLogcat) log=String(window.parent.Android.getLogcat(100)); }catch(e){}
  if(!log){
    setHtml('out','<div class="err">Not available from external browser. Logcat via Android bridge (WebView only).<br>Use adb logcat, or open in mtapi.</div>');
    return;
  }
  var lines=log.split('\n').slice().reverse();
  var rows=[];
  var re=/^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s?(.*)$/;
  lines.forEach(function(l){
    if(!l) return;
    var m=l.match(re);
    if(m){ rows.push([esc(m[2]),esc(m[3]),esc(m[4]),'<span class="lvl-'+m[5].toLowerCase()+'">'+m[5]+'</span>',esc(m[6]),esc(m[7])]); }
    else { rows.push(['-','','','','',esc(l)]); }
  });
  setHtml('out',tableHtml(rows,['Time','PID','TID','L','Tag','Message']));
}
load();
if(TOKEN) setInterval(load,3000);
</script>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, pageLayout("Logcat", "/logcat", token, body))
}

func (s *apiServer) devtoolsPageHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	body := `<h1>DevTools</h1>
<div class="bar"><button onclick="load()">↻ Refresh</button><button class="g" onclick="copyId('out')">📋 Copy</button></div>
<p class="hint">WebView DevTools JSON (/devtools/json). Works everywhere.</p>
<div id="out"><span class="spin"></span></div>
<script>
function load(){
  setHtml('out','<span class="spin"></span>');
  fetch('/devtools/json').then(function(r){return r.json()}).then(function(j){
    setHtml('out','<pre>'+esc(JSON.stringify(j,null,2))+'</pre>');
  }).catch(function(e){ setHtml('out','<div class="err">'+esc(e.message)+'</div>'); });
}
load();
</script>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, pageLayout("DevTools", "/devtools", token, body))
}

func (s *apiServer) sysPageHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	body := `<h1>System</h1>
<div class="bar"><button onclick="load()">↻ Refresh</button><button class="g" onclick="copyId('out')">📋 Copy</button><label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#555;cursor:pointer"><input type="checkbox" id="pretty" checked onchange="load()"> Pretty print (json - table)</label></div>
<p class="hint">System info (/system, /cpu/detail, /memory, /storage). Works everywhere.</p>
<div id="out"><span class="spin"></span></div>
<script>
function load(){
  var usePretty = true;
  try { usePretty = document.getElementById('pretty').checked; } catch(e) {}
  setHtml('out','<span class="spin"></span>');
  var _t0 = Date.now();
  Promise.all([
    fetch('/system').then(function(r){return r.json()}).catch(function(e){return {error:e.message}}),
    fetch('/cpu/detail').then(function(r){return r.json()}).catch(function(e){return {error:e.message}}),
    fetch('/memory').then(function(r){return r.json()}).catch(function(e){return {error:e.message}}),
    fetch('/storage').then(function(r){return r.json()}).catch(function(e){return {error:e.message}})
  ]).then(function(arr){
    var names=['System','CPU','Memory','Storage'];
    var h='';
    arr.forEach(function(o,i){
      h+='<h2>'+names[i]+'</h2>';
      if (usePretty && typeof renderJSON === 'function') h += renderJSON(o);
      else h += '<pre>'+esc(JSON.stringify(o,null,2))+'</pre>';
    });
    var delay = Math.max(0, 400 - (Date.now() - _t0));
    setTimeout(function(){ setHtml('out',h); }, delay);
  });
}
load();
</script>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, pageLayout("System", "/sys", token, body))
}

func (s *apiServer) netPageHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	body := `<h1>Network</h1>
<div class="bar"><button onclick="load()">↻ Refresh</button><button class="g" onclick="copyId('out')">📋 Copy</button></div>
<p class="hint">Requests from WebView memory (parent._netBuf). External browser: not available.</p>
<div id="out"><span class="spin"></span></div>
<script>
function load(){
  var buf=[];
  try{ buf=(window.parent&&window.parent._netBuf)||[]; }catch(e){}
  if(!buf||!buf.length){
    setHtml('out','<div class="err">Not available from external browser. Network buffer lives in WebView memory.<br>Open in mtapi (FAB 🐞 → Network) or in iframe from browser.</div>');
    return;
  }
  var rows=buf.slice().reverse().map(function(e){
    var t=''; try{t=new Date(e.t).toLocaleTimeString()}catch(x){}
    var ok = e.status && e.status < 400;
    return [esc(t),esc(e.method||''),esc(e.url||''),'<span style="color:'+(ok?'#080':'#c00')+'">'+esc(e.status||'')+'</span>',esc(e.size||''),esc(e.ms||'')];
  });
  setHtml('out',tableHtml(rows,['Time','Method','URL','Status','Size','ms']));
}
load();
if(TOKEN) setInterval(load,1000);
</script>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, pageLayout("Network", "/net", token, body))
}
