package main

import (
	"fmt"
	"net/http"
)

const consoleTabsCSS = `body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fafafa;color:#1a1a1a;margin:0;padding:10px;font-size:12px;line-height:1.4}h1{color:#0288d1;font-size:15px;margin:0 0 6px}.tabs{display:flex;gap:4px;overflow-x:auto;padding:6px 0;border-bottom:1px solid #e0e0e0;margin-bottom:10px}.tabs button{padding:5px 12px;background:#fff;border:1px solid #e0e0e0;border-radius:4px;color:#555;white-space:nowrap;font-size:11px;cursor:pointer;font-family:inherit}.tabs button.active{background:#0288d1;color:#fff;border-color:#0288d1}.tabs button:hover{background:#e3f2fd}.tabs button.active:hover{background:#0277bd}.pane{display:none}.pane.active{display:block}.bar{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}button.act{background:#0288d1;color:#fff;border:none;border-radius:4px;padding:5px 12px;font-family:monospace;font-size:11px;cursor:pointer}button.act:hover{background:#0277bd}button.g{background:#e0e0e0;color:#1a1a1a;border:1px solid #ccc;border-radius:4px;padding:4px 10px;font-family:monospace;font-size:11px;cursor:pointer}button.g:hover{background:#d0d0d0}pre{background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:8px;margin:0;white-space:pre-wrap;word-break:break-all;overflow:auto;max-height:70vh;font-size:11px}textarea{width:100%;box-sizing:border-box;padding:8px;background:#fff;color:#1a1a1a;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:12px;resize:vertical;min-height:50px}table{width:100%;border-collapse:collapse;background:#fff;font-size:11px}th,td{border:1px solid #e0e0e0;padding:3px 6px;text-align:left;vertical-align:top}th{background:#e3f2fd;color:#555;position:sticky;top:0}.hint{color:#888;font-size:11px;margin:4px 0}.err{color:#c00;background:#fff3f3;border:1px solid #fcc;padding:8px;border-radius:4px}.lvl-e{color:#c00}.lvl-w{color:#e67e22}.lvl-v{color:#888}#out{padding:6px;background:#fff;border:1px solid #e0e0e0;border-radius:4px;min-height:60px;overflow:auto;max-height:70vh;white-space:pre-wrap;font-family:monospace;font-size:12px}.spin{display:inline-block;width:12px;height:12px;border:2px solid #e0e0e0;border-top-color:#0288d1;border-radius:50%;animation:mtapi-spin 0.8s linear infinite;vertical-align:middle}@keyframes mtapi-spin{to{transform:rotate(360deg)}}`

func (s *apiServer) consoleHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	w.Header().Set("Pragma", "no-cache")

	body := `<h1>🖥️ Console — 5 tools</h1>
<div class="tabs" id="tabs">
<button data-tab="console" class="active">Console</button>
<button data-tab="logs">Logs</button>
<button data-tab="errors">Errors</button>
<button data-tab="logcat">Logcat</button>
<button data-tab="sys">System</button>
</div>

<!-- Console -->
<div class="pane active" id="pane-console">
<div class="hint">Ctrl+Enter to run. await works.</div>
<textarea id="cmd" placeholder="await fetch('/battery').then(r => r.json())"></textarea>
<div class="bar"><button class="act" id="run">▶ Run</button><button class="g" id="clear">🗑 Clear</button><button class="g" id="copy">📋 Copy</button></div>
<div id="out">—</div>
</div>

<!-- Logs -->
<div class="pane" id="pane-logs">
<div class="bar"><button class="act" onclick="loadLogs()">↻ Refresh</button><button class="g" onclick="copyId('logs-out')">📋 Copy</button></div>
<div class="hint">JS logs from WebView memory (parent.MtapiDebug.buffer). External browser: n/a.</div>
<div id="logs-out"><span class="spin"></span></div>
</div>

<!-- Errors -->
<div class="pane" id="pane-errors">
<div class="bar"><button class="act" onclick="loadErrors()">↻ Refresh</button><button class="g" onclick="copyId('errors-out')">📋 Copy</button></div>
<div class="hint">Persistent errors (localStorage). Works everywhere.</div>
<div id="errors-out"><span class="spin"></span></div>
</div>

<!-- Logcat -->
<div class="pane" id="pane-logcat">
<div class="bar"><button class="act" onclick="loadLogcat()">↻ Refresh</button><button class="g" onclick="copyId('logcat-out')">📋 Copy</button></div>
<div class="hint">Logcat via Android bridge (parent.Android.getLogcat). External browser: n/a.</div>
<div id="logcat-out"><span class="spin"></span></div>
</div>

<!-- Sys -->
<div class="pane" id="pane-sys">
<div class="bar"><button class="act" onclick="loadSys()">↻ Refresh</button><button class="g" onclick="copyId('sys-out')">📋 Copy</button></div>
<div class="hint">GET /system, /cpu/detail, /memory, /storage. Works everywhere.</div>
<div id="sys-out"><span class="spin"></span></div>
</div>

<script>
var TOKEN = (location.search.match(/[?&]token=([^&]+)/) || [])[1] || '';
var _origFetch = window.fetch;
window.fetch = function(u, o) {
  try { if (typeof u === 'string' && u.charAt(0) === '/' && u.indexOf('token=') < 0) u += (u.indexOf('?')>=0?'&':'?') + 'token=' + TOKEN; } catch(e){}
  return _origFetch.call(window, u, o);
};

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function setHtml(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h}
function tableHtml(rows,cols){var h='<table><thead><tr>';cols.forEach(function(c){h+='<th>'+esc(c)+'</th>'});h+='</tr></thead><tbody>';rows.forEach(function(r){h+='<tr>';r.forEach(function(c){h+='<td>'+c+'</td>'});h+='</tr>'});h+='</tbody></table>';return h}
function copyId(id){var el=document.getElementById(id);if(!el)return;var t=el.textContent||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){alert('Copied '+t.length+' chars')})}else{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)}}

// ── Tabs ──
function setTab(name) {
  document.querySelectorAll('#tabs button').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===name); });
  document.querySelectorAll('.pane').forEach(function(p){ p.classList.toggle('active', p.id==='pane-'+name); });
  if (location.hash !== '#'+name) history.replaceState(null,'','#'+name);
  if (name==='logs') loadLogs();
  else if (name==='errors') loadErrors();
  else if (name==='logcat') loadLogcat();
  else if (name==='sys') loadSys();
  else if (name==='console') document.getElementById('cmd').focus();
}
document.querySelectorAll('#tabs button').forEach(function(b){
  b.onclick = function(){ setTab(b.getAttribute('data-tab')); };
});
window.addEventListener('hashchange', function(){ var n=(location.hash||'#console').slice(1); if(n) setTab(n); });

// ── Console ──
var out = document.getElementById('out');
var inp = document.getElementById('cmd');

// log/warn/error → output (для удобства)
window.log = function() {
  var args = Array.prototype.slice.call(arguments).map(function(a){
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
  }).join(' ');
  out.innerHTML = (out.innerHTML === '—' ? '' : out.innerHTML + '\n') + '<span style="color:#0288d1">[log]</span> ' + esc(args);
};
window.warn = function() {
  var args = Array.prototype.slice.call(arguments).map(function(a){
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
  }).join(' ');
  out.innerHTML = (out.innerHTML === '—' ? '' : out.innerHTML + '\n') + '<span style="color:#e67e22">[warn]</span> ' + esc(args);
};
window.error = function() {
  var args = Array.prototype.slice.call(arguments).map(function(a){
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
  }).join(' ');
  out.innerHTML = (out.innerHTML === '—' ? '' : out.innerHTML + '\n') + '<span style="color:#c00">[error]</span> ' + esc(args);
};
function render(r){
  if(r===undefined) return '<span style="color:#888">→ undefined</span>';
  if(r===null) return '<span style="color:#888">null</span>';
  if(typeof r==='string') return '<pre style="margin:0;white-space:pre-wrap">'+esc(r)+'</pre>';
  if(typeof r==='object'){ try{ return '<pre style="margin:0;white-space:pre-wrap">'+esc(JSON.stringify(r,null,2))+'</pre>'; }catch(e){} }
  return '<pre style="margin:0">'+esc(String(r))+'</pre>';
}
async function run(){
  var cmd=(inp.value||'').trim(); if(!cmd) return;

  // ── Help levels ──
  if (cmd === '?' || cmd === 'help' || cmd === 'help()') {
    out.innerHTML = '<pre style="margin:0;white-space:pre-wrap">' + esc('=== Console — quick (?) ===\n\nawait fetch("/battery").then(r => r.json())\nawait fetch("/sensors").then(r => r.json())\nawait fetch("/system").then(r => r.json())\n\n??  cheatsheet\n??? full') + '</pre>';
    return;
  }
  if (cmd === '??') {
    out.innerHTML = '<pre style="margin:0;white-space:pre-wrap">' + esc('=== Console — cheatsheet (??) ===\n\nawait fetch("/battery").then(r => r.json())\nawait fetch("/sensors").then(r => r.json())\nawait fetch("/system").then(r => r.json())\nawait fetch("/wifi").then(r => r.json())\n1+1\n$("#main")\n$$("details").length\nlocation.hash = "#logs"\nlocation.hash = "#errors"\nlocation.hash = "#logcat"\nlocation.hash = "#sys"') + '</pre>';
    return;
  }
  if (cmd === '???' || cmd === 'examples()' || cmd === 'nav()') {
    out.innerHTML = '<pre style="margin:0;white-space:pre-wrap">' + esc('=== Console — full (???) ===\n\nawait fetch("/ping").then(r => r.json())\nawait fetch("/battery").then(r => r.json())\nawait fetch("/battery/detailed").then(r => r.json())\nawait fetch("/wifi").then(r => r.json())\nawait fetch("/wifi/detailed").then(r => r.json())\nawait fetch("/device").then(r => r.json())\nawait fetch("/location").then(r => r.json())\nawait fetch("/system").then(r => r.json())\nawait fetch("/cpu/detail").then(r => r.json())\nawait fetch("/thermal").then(r => r.json())\nawait fetch("/memory").then(r => r.json())\nawait fetch("/storage").then(r => r.json())\nawait fetch("/kernel").then(r => r.json())\nawait fetch("/network").then(r => r.json())\nawait fetch("/sensors").then(r => r.json())\nawait fetch("/features").then(r => r.json())\nawait fetch("/camera/list").then(r => r.json())\nawait fetch("/app/list").then(r => r.json())') + '</pre>';
    return;
  }
  var res;
  var _prevOut = out.innerHTML;
  try{
    var _wrapped = /(^|[^a-zA-Z0-9_$.])await(\s|$)/.test(cmd) ? '(async () => { return (' + cmd + '); })()' : cmd;
    res = eval(_wrapped);
    if(res && typeof res.then==='function') res = await res;
  }catch(e){ out.innerHTML='<span style="color:#c00">Error: '+esc(e.message)+'</span>'; return; }
  // If log()/warn()/error() wrote to out during eval — don't overwrite with undefined
  if (res === undefined && out.innerHTML !== _prevOut) {
    return;
  }
  out.innerHTML = render(res);
}

// ── Programmatic API ──
window.runCode = async function(code) {
  var cmd = document.getElementById('cmd');
  if (!cmd) return null;
  cmd.value = String(code);
  await run();
  var out = document.getElementById('out');
  return out ? (out.textContent || '') : null;
};

// postMessage: { type: 'console-eval', code: '...' }
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'console-eval' && e.data.code) {
    window.runCode(e.data.code);
  }
});
document.getElementById('run').onclick = run;
inp.onkeydown = function(e){ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); run(); } };
document.getElementById('clear').onclick = function(){ out.innerHTML='—'; inp.value=''; };
document.getElementById('copy').onclick = function(){ var t=out.textContent||''; if(navigator.clipboard){ navigator.clipboard.writeText(t).then(function(){alert('Copied '+t.length+' chars')}); } };

// ── Loaders ──
function loadLogs(){
  var buf=[]; try{ if(window.parent&&window.parent.MtapiDebug&&window.parent.MtapiDebug.buffer) buf=window.parent.MtapiDebug.buffer(); }catch(e){}
  if(!buf||!buf.length){
    setHtml('logs-out','<div class="err">Not available from external browser. JS logs live in WebView memory.<br>Open in mtapi (FAB 🐞 → Logs) or use iframe in browser overlay.</div>');
    return;
  }
  var rows=buf.slice().reverse().map(function(e){
    var t=''; try{t=new Date(e.t).toLocaleTimeString()}catch(x){}
    var lvl=(e.lvl||'log').toLowerCase();
    var cls='lvl-'+(lvl==='error'?'e':lvl==='warn'?'w':'v');
    return [esc(t),'<span class="'+cls+'">'+esc((e.lvl||'log').toUpperCase())+'</span>',esc(e.m)];
  });
  setHtml('logs-out',tableHtml(rows,['Time','L','Message']));
}

function loadErrors(){
  var er=[]; try{ er=JSON.parse(localStorage.getItem('mtapi-errors')||'[]'); }catch(e){}
  if(!er.length){ setHtml('errors-out','<p class="hint">(no errors)</p>'); return; }
  var rows=er.map(function(x){
    var t=''; try{t=new Date(x.t).toLocaleTimeString()}catch(e){}
    return [esc(t),'<span class="lvl-e">E</span>',esc(x.m)];
  });
  setHtml('errors-out',tableHtml(rows,['Time','L','Error']));
}

function loadLogcat(){
  var log='';
  try{ if(window.parent&&window.parent.Android&&window.parent.Android.getLogcat) log=String(window.parent.Android.getLogcat(100)); }catch(e){}
  if(!log){
    setHtml('logcat-out','<div class="err">Not available from external browser. Logcat via Android bridge (WebView only).<br>Use adb logcat, or open in mtapi.</div>');
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
  setHtml('logcat-out',tableHtml(rows,['Time','PID','TID','L','Tag','Message']));
}



function renderJSON(o){
  if(o===null||o===undefined) return '<span style="color:#888">'+String(o)+'</span>';
  if(typeof o!=='object') return '<span>'+esc(String(o))+'</span>';
  if(Array.isArray(o)){
    if(!o.length) return '<span style="color:#888">(empty array)</span>';
    if(typeof o[0]!=='object'){
      return '<table><tbody>'+o.map(function(v){return '<tr><td>'+esc(String(v))+'</td></tr>'}).join('')+'</tbody></table>';
    }
    var keys={};
    o.forEach(function(it){ Object.keys(it).forEach(function(k){keys[k]=1}); });
    var cols=Object.keys(keys);
    var h='<table><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>';
    o.forEach(function(it){
      h+='<tr>'+cols.map(function(c){ var v=it[c]; return '<td>'+renderJSON(v)+'</td>'; }).join('')+'</tr>';
    });
    return h+'</tbody></table>';
  }
  // object
  var keys=Object.keys(o);
  if(!keys.length) return '<span style="color:#888">{}</span>';
  var h='<table><tbody>';
  keys.forEach(function(k){
    var v=o[k];
    if(v!==null && typeof v==='object'){
      h+='<tr><td style="color:#888;vertical-align:top;width:160px">'+esc(k)+'</td><td>'+renderJSON(v)+'</td></tr>';
    }else{
      h+='<tr><td style="color:#888;width:160px">'+esc(k)+'</td><td>'+esc(String(v))+'</td></tr>';
    }
  });
  return h+'</tbody></table>';
}

function loadSys(){
  setHtml('sys-out','<span class="spin"></span>');
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
      h+='<h3 style="color:#0288d1;margin:12px 0 4px">'+names[i]+'</h3>';
      if(o && o.error){ h+='<div class="err">'+esc(o.error)+'</div>'; }
      else { h+=renderJSON(o); }
    });
    var delay = Math.max(0, 400 - (Date.now() - _t0));
    setTimeout(function(){ setHtml('sys-out',h); }, delay);
  });
}



// ── Init ──
var initTab = (location.hash||'#console').slice(1) || 'console';
setTab(initTab);
if (initTab==='console') inp.focus();
// auto-refresh active tab
setInterval(function(){
  var active = document.querySelector('#tabs button.active');
  if(!active) return;
  var n = active.getAttribute('data-tab');
  if(n==='logs') loadLogs();
  else if(n==='logcat') loadLogcat();
  else if(n==='errors') loadErrors();
}, 3000);
</script>`

	fmt.Fprint(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>mtapi — Console</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>`+consoleTabsCSS+`</style></head><body>`+body+`</body></html>`)
}
