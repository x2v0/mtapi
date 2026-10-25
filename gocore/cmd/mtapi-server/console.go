package main

import "net/http"

const consoleHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>mtapi — Console</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fafafa;color:#1a1a1a;margin:0;padding:12px;font-size:13px}
h1{color:#0288d1;font-size:16px;margin:0 0 8px}
textarea{width:100%;box-sizing:border-box;padding:8px;background:#fff;color:#1a1a1a;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:12px;resize:vertical;min-height:60px}
button{background:#0288d1;color:#fff;border:none;border-radius:4px;padding:6px 12px;font-family:monospace;font-size:12px;cursor:pointer;margin:4px 4px 4px 0}
button:hover{background:#0277bd}
button.gray{background:#e0e0e0;color:#1a1a1a}
button.gray:hover{background:#d0d0d0}
#out{background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:8px;min-height:200px;white-space:pre-wrap;font-family:monospace;font-size:12px;overflow:auto;max-height:60vh}
.hint{color:#888;font-size:11px;margin:0 0 8px}
kbd{background:#e0e0e0;padding:1px 4px;border-radius:3px;font-size:10px}
</style></head><body>
<h1>🖥️ Console</h1>
<p class="hint">Ctrl+Enter to run. <kbd>help()</kbd> / <kbd>??</kbd> / <kbd>???</kbd> for examples.</p>
<textarea id="cmd" placeholder="JS... (Ctrl+Enter to run)"></textarea>
<div>
<button id="run">▶ Run</button>
<button id="clear" class="gray">🗑 Clear</button>
<button id="copy" class="gray">📋 Copy</button>
<button id="help" class="gray">? Help</button>
</div>
<div id="out">—</div>
<script>
// ── Auto-add token to same-origin fetches ──
var TOKEN = (location.search.match(/[?&]token=([^&]+)/) || [])[1] || '';
var _origFetch = window.fetch;
window.fetch = function(url, opts) {
  try {
    if (typeof url === 'string' && url.charAt(0) === '/' && url.indexOf('token=') < 0) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'token=' + TOKEN;
    }
  } catch(e) {}
  return _origFetch.call(window, url, opts);
};
console.log('[console] token:', TOKEN ? TOKEN.slice(0,8)+'...' : 'MISSING');

var out = document.getElementById('out');
var inp = document.getElementById('cmd');
var _origLog = console.log;
console.log = function() {
  var args = Array.prototype.slice.call(arguments).map(function(a){
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); }
  }).join(' ');
  _origLog.apply(console, arguments);
  var cur = out.innerHTML;
  out.innerHTML = cur + (cur === '—' ? '' : '\n') + '<span style="color:#0288d1">[log]</span> ' + esc(args);
};

function print(html) {
  out.innerHTML = html;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function render(r) {
  if (r === undefined) return '<span style="color:#888">→ undefined</span>';
  if (r === null) return '<span style="color:#888">null</span>';
  if (typeof r === 'string') return '<pre style="margin:0;white-space:pre-wrap">' + esc(r) + '</pre>';
  if (typeof r === 'object') {
    try { return '<pre style="margin:0;white-space:pre-wrap">' + esc(JSON.stringify(r, null, 2)) + '</pre>'; } catch(e){}
  }
  return '<pre style="margin:0">' + esc(String(r)) + '</pre>';
}

async function run() {
  var cmd = (inp.value || '').trim();
  if (!cmd) return;
  var res;
  try {
    var _wrapped = /(^|[^a-zA-Z0-9_$.])await(\s|$)/.test(cmd) ? '(async () => { return (' + cmd + '); })()' : cmd;
    res = eval(_wrapped);
    if (res && typeof res.then === 'function') {
      res = await res;
    }
  } catch(e) {
    res = '<span style="color:#c00">Error: ' + esc(e.message) + '</span>';
    print(res);
    return;
  }
  print(render(res));
}

document.getElementById('run').onclick = run;
inp.onkeydown = function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
};
document.getElementById('clear').onclick = function() { out.innerHTML = '—'; inp.value = ''; };
document.getElementById('copy').onclick = function() {
  var t = out.textContent || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function(){ out.innerHTML = '<span style="color:#080">Copied (' + t.length + ' chars)</span>'; });
  } else {
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
};
document.getElementById('help').onclick = function() {
  if (window.parent && window.parent._evalHelp) { window.parent._evalHelp(); out.innerHTML = '<span style="color:#888">(help shown in parent Console Eval)</span>'; }
  else { out.innerHTML = '<pre style="margin:0;white-space:pre-wrap">' + esc('help: fetch("/battery")...') + '</pre>'; }
};
inp.focus();
</script>
</body></html>`

func (s *apiServer) consoleHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(consoleHTML))
}
