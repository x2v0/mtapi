if (typeof window === 'undefined') { globalThis.window = {}; }


// MTAPI_FMT_TIME: локальное время HH:MM:SS.mmm (как logcat)
function _fmtTime(ms) {
  var d = new Date(ms);
  var h = String(d.getHours()).padStart(2, '0');
  var m = String(d.getMinutes()).padStart(2, '0');
  var s = String(d.getSeconds()).padStart(2, '0');
  var ms3 = String(d.getMilliseconds()).padStart(3, '0');
  return h + ':' + m + ':' + s + '.' + ms3;
}

// MTAPI_JSLOG: перехват console.* в буфер (MIUI блокирует chromium logs при debuggable=false)
(function(){
  if (typeof window === 'undefined') return;
  window._jslogBuf = window._jslogBuf || [];
  window._jslogMax = 500;
  var orig = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  function push(level, args) {
    try {
      var msg = Array.prototype.map.call(args, function(a){
        if (a instanceof Error || (a && a.stack && a.message)) return a.stack || (a.name + ': ' + a.message);
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch(e) { return String(a); } }
        return String(a);
      }).join(' ');
      var line = { t: Date.now(), lvl: level, m: msg };
      window._jslogBuf.push(line);
      if (window._jslogBuf.length > window._jslogMax) window._jslogBuf.shift();
      // MTAPI_PERSIST_ERR: ошибки в localStorage (выживают reload)
      if (level === 'error') {
        try {
          var _perrs = JSON.parse(localStorage.getItem('mtapi-errors') || '[]');
          _perrs.unshift({ t: line.t, lvl: level, m: msg });
          if (_perrs.length > 50) _perrs.length = 50;
          localStorage.setItem('mtapi-errors', JSON.stringify(_perrs));
        } catch(e) {}
      }
      // MTAPI_JSLOG_LIVE: append to DOM if section visible (no polling needed)
      try {
        var pre = document.getElementById('jslog-pre');
        if (pre) {
          var lv = level || 'log';
          var cls = 'logcat-line lvl-' + (lv === 'error' ? 'e' : lv === 'warn' ? 'w' : lv === 'info' ? 'i' : lv === 'debug' ? 'd' : 'v');
          var tstr = _fmtTime(line.t);
          var text = tstr + ' [' + lv + '] ' + msg;
          var span = document.createElement('span');
          span.className = cls;
          span.setAttribute('data-orig', text);
          span.textContent = text;
          // MTAPI_JSLOG_REVERSE: prepend (новые сверху)
          var frag = document.createDocumentFragment();
          frag.appendChild(span);
          frag.appendChild(document.createTextNode('\n'));
          pre.insertBefore(frag, pre.firstChild);
          var sub = document.getElementById('jslog-sub');
          if (sub) {
            var sum = sub.querySelector('summary');
            if (sum) sum.textContent = 'JS Logs (' + window._jslogBuf.length + ')';
          }
          // MTAPI_JSLOG_REVERSE: если был наверху — оставить наверху (новые видны)
          if (pre.scrollTop < 50) pre.scrollTop = 0;
        }
      } catch(e2) {}
    } catch(e) {}
  }
  ['log','warn','error','info','debug'].forEach(function(k){
    console[k] = function(){
      push(k, arguments);
      try { orig[k].apply(console, arguments); } catch(e) {}
    };
  });
  // MTAPI_JSLOG_SAFE: window.addEventListener отсутствует в Node.js
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('error', function(ev){
      push('error', ['Uncaught: ' + (ev.message || '?') + ' at ' + (ev.filename||'') + ':' + (ev.lineno||0)]);
    });
    window.addEventListener('unhandledrejection', function(ev){
      push('error', ['UnhandledRejection: ' + (ev.reason && ev.reason.message || ev.reason)]);
    });
  }
})();

// MTAPI_JSLOG_NETWORK: перехват fetch → JS Logs (Network в Console)
(function(){
  if (typeof window === 'undefined') return;
  var _origFetch = window.fetch;
  if (typeof _origFetch !== 'function') return;
  window.fetch = function(url, opts) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var method = (opts && opts.method) ? String(opts.method).toUpperCase() : 'GET';
    var urlStr = String(url);
    // MTAPI_NET_QUIET_DEBUG: не логировать /debug (spam от logcat live 3с)
    var _noLog = /\/debug(\?|$)/.test(urlStr);
    if (!_noLog) console.log('[net] → ' + method + ' ' + urlStr);
    return _origFetch(url, opts).then(function(r){
      var ms = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
      var _cl = (r.headers && r.headers.get) ? (r.headers.get('content-length') || '?') : '?';
      var _ct = (r.headers && r.headers.get) ? ((r.headers.get('content-type') || '?').split(';')[0]) : '?';
      if (!_noLog) console.log('[net] ← ' + r.status + ' ' + method + ' ' + urlStr + ' (' + ms + 'ms, ' + _cl + 'b, ' + _ct + ')');
      return r;
    }).catch(function(e){
      var ms = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
      if (!_noLog) console.log('[net] ✗ ' + method + ' ' + urlStr + ' (' + ms + 'ms) ' + (e && e.message || e));
      throw e;
    });
  };
})();




// MTAPI_293: fetch с timeout (AbortController)
function _fetch(url, opts) {
  opts = opts || {};
  // MTAPI_299: WebView-safe timeout
  var _to = null;
  if (typeof AbortController !== 'undefined') {
    try {
      var ctrl = new AbortController();
      if (!opts.signal) opts.signal = ctrl.signal;
      _to = setTimeout(function(){ try { ctrl.abort(); } catch(e){} }, 5000);
      if (_to && typeof _to.unref === 'function') _to.unref();
    } catch (e) {
      // AbortController not supported — ignore
    }
  }
  var _p = fetch(url, opts);
  if (_to) _p.then(function(){ clearTimeout(_to); }, function(){ clearTimeout(_to); });
  return _p;
}

// MTAPI_270: LOG_LEVEL_TITLES — единственная копия (дубликат удалён)
var LOG_LEVEL_TITLES = {
  V: 'V — Verbose (все сообщения)',
  D: 'D — Debug (отладочная информация)',
  I: 'I — Info (обычные события)',
  W: 'W — Warn (предупреждения)',
  E: 'E — Error (ошибки)',
  F: 'F — Fatal (критические, краш)',
};

// MTAPI_LOGCAT_LIVE_FLAG: временно отключить автообновление logcat (GET /debug?token= каждые 3с)
// true  = включено (setInterval 3000 → reloadLogcat → GET /debug)
// false = отключено (только ⟳ кнопка + toggle секций + open /debug)
var _LOGCAT_LIVE_ENABLED = true;

// ─── MTAPI_145: localStorage polyfill ───
(function() {
  if (typeof localStorage === 'undefined') {
    var _ls = {};
    globalThis.localStorage = {
      getItem: function(k) { return _ls.hasOwnProperty(k) ? _ls[k] : null; },
      setItem: function(k, v) { _ls[k] = String(v); },
      removeItem: function(k) { delete _ls[k]; },
      clear: function() { _ls = {}; },
      key: function(i) { return Object.keys(_ls)[i] || null; },
      get length() { return Object.keys(_ls).length; }
    };
  }
})();

// MTAPI_HARD_RESET_76: clean slate — no SW, no auto-click, no semaphore.
// /ping is synthetic server-side. Client only does what user clicks.
// TOKEN берётся из window (index.html)
if (typeof document !== 'undefined') document.title = "[mtapi] loaded " + (TOKEN ? TOKEN.slice(0,8) : "empty");
try { document.title = "L:" + (TOKEN ? TOKEN.slice(0,4) : "null"); } catch(e) {}

const ENDPOINTS = [
  { group: "Basic", eps: [
    "/ping", "/battery", "/wifi", "/device", "/location",
    "/clipboard", "/clipboard?op=set&text=hello",
    "/toast?text=hello", "/notify?title=Hi&body=There",
    "/vibrate?ms=200", "/torch?on=1", "/torch?on=0",
    "/torch/brightness?level=50", "/torch/brightness?level=0",
    "/tts?text=hello", "/share?title=Hi&text=There"
  ]},
  { group: "Contacts / SMS", eps: [
    "/contacts?limit=0", "/calllog?limit=0", "/sms?limit=0"
  ]},
  { group: "System", eps: [
    "/system", "/cpu/detail", "/thermal", "/memory", "/storage", "/kernel"
  ]},
  { group: "Network", eps: [
    "/network", "/wifi/detailed", "/bluetooth", "/telephony",
    "/wifi/scan", "/net/ping?host=8.8.8.8&count=3",
    "/net/dns?host=example.com",
    "/net/fetch?url=https%3A%2F%2Fapi.ipify.org%3Fformat%3Djson"
  ]},
  { group: "Display / Audio", eps: [
    "/display", "/display/brightness", "/display/color",
    "/audio", "/microphone", "/audio/volume?stream=2", "/audio/ringer"
  ]},
  { group: "Sensors", eps: [
    "/sensors", "/sensors/read?name=accelerometer&ms=200",
    "/sensors/stream?name=accelerometer&hz=10",
    "/sensors/stream/stop?name=accelerometer"
  ]},
  { group: "Hardware", eps: [
    "/features", "/camera/list", "/camera/snapshot",
    "/microphone/record?seconds=3"
  ]},
  { group: "Apps", eps: [
    "/app/list", "/app/launch?pkg=com.android.settings"
  ]},
  { group: "Detailed", eps: [
    "/battery/detailed", "/location/detailed", "/locale",
    "/calendar?days=7", "/alarm/next"
  ]},
  { group: "Files / Audio play", eps: [
    "/files/save?name=test.txt&data=hello",
    "/audio/play?uri=/system/media/audio/notifications/Hello.ogg",
    "/audio/play/stop", "/tts/voices", "/tts/stop"
  ]},
  { group: "Watch (logcat)", eps: [
    "/clipboard/watch?hz=2", "/clipboard/watch/stop",
    "/location/watch?hz=1", "/location/watch/stop"
  ]}
];

const SLOW = new Set([
  "/camera/snapshot","/microphone/record?seconds=3",
  "/sensors/read?name=accelerometer&ms=200",
  "/contacts?limit=0","/calllog?limit=0","/sms?limit=0",
  "/calendar?days=7","/app/list"
]);

// ─── renderers (единственные копии — дубликаты удалены) ──
function esc(s){return String(s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cellStr(v){
  if(v===null)return'null';
  if(v===undefined)return'';
  if(typeof v==='object')return JSON.stringify(v);
  return String(v);
}
function classifyValue(v){
  if(v===null||v===undefined)return'v-null';
  if(typeof v==='boolean')return v?'v-bool-t':'v-bool-f';
  if(typeof v==='number')return'v-num';
  return'';
}
function _isScalar(v){
  return v===null||v===undefined||
    typeof v==='number'||typeof v==='string'||typeof v==='boolean';
}
function _scalarCell(v){
  return '<td class="'+classifyValue(v)+'">'+esc(cellStr(v))+'</td>';
}

// MTAPI_354: copyLogcat — копировать logcat в clipboard
if (typeof window !== "undefined") window._copyLogcat = function() {
  try {
    var pre = document.getElementById('logcat-pre');
    if (!pre) { alert('logcat-pre не найден'); return; }
    var text = pre.textContent || pre.innerText || '';
    if (!text) { alert('logcat пуст'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){
        console.log('[mtapi] copied ' + text.length + ' bytes');
      }).catch(function(e){
        _copyFallback(text);
      });
    } else {
      _copyFallback(text);
    }
  } catch(e) { alert('error: ' + e.message); }
};

function _copyFallback(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    console.log('[mtapi] copied (execCommand) ' + text.length + ' bytes');
  } catch(e) { alert('fallback error: ' + e.message); }
}


// MTAPI_315: DevTools — открыть в WebView (встроенный devtools frontend)
// MTAPI_DEVTOOLS_FIX: мёртвый appspot URL убран, только info + native
// MTAPI_WS_FIX: WebView отдаёт ws://localhost/... (без порта).
// Для ПК после adb forward tcp:9222 нужен ws://localhost:9222/...
function _normalizeDevtoolsWs(ws) {
  if (!ws) return ws;
  // ws://localhost/devtools/... → ws://localhost:9222/devtools/...
  // ws://127.0.0.1/devtools/... → ws://127.0.0.1:9222/devtools/...
  if (/^wss?:\/\/(localhost|127\.0\.0\.1)\//i.test(ws)) {
    return ws.replace(/^(wss?:\/\/(?:localhost|127\.0\.0\.1))\//i, '$1:9222/');
  }
  return ws;
}

if (typeof window !== "undefined") window._openDevtools = function(wsUrl) {
  try {
    wsUrl = _normalizeDevtoolsWs(wsUrl);
    // 1. Native (Toast + clipboard)
    if (typeof Android !== 'undefined' && typeof Android.openDevtools === 'function') {
      Android.openDevtools(wsUrl);
      console.log('[mtapi] devtools → native');
      return;
    }
    // 2. Fallback: info-блок + копия в clipboard
    var frame = document.getElementById('devtools-frame');
    if (frame) {
      var path = wsUrl;
      var p = wsUrl.indexOf('/devtools/');
      if (p >= 0) path = wsUrl.substring(p);
      frame.innerHTML =
        '<div style="padding:12px;font-size:12px;line-height:1.6">' +
        '<b>WebView DevTools</b><br><br>' +
        '<b>На телефоне:</b> Copy WS → в clipboard.<br>' +
        '<b>На ПК:</b> adb forward → chrome://inspect<br><br>' +
        '<b>Команды (ПК):</b><br>' +
        '<code>adb shell pidof dev.mtapi</code><br>' +
        '<code>adb forward tcp:9222 localabstract:webview_devtools_remote_&lt;PID&gt;</code><br>' +
        '<code>chrome://inspect/#devices</code><br><br>' +
        '<b>WS (в clipboard):</b><br>' +
        '<code style="font-size:10px;word-break:break-all">ws://localhost:9222' + esc(path) + '</code>' +
        '</div>';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(wsUrl).then(function(){
        console.log('[mtapi] devtools WS copied');
      }).catch(function(){});
    }
    console.log('[mtapi] openDevtools fallback:', wsUrl);
  } catch(e) { console.log('[mtapi] openDevtools err:', e.message); }
};

// MTAPI_315: copy WebSocket URL
if (typeof window !== "undefined") window._copyDevtools = function(wsUrl) {
  try {
    wsUrl = _normalizeDevtoolsWs(wsUrl);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(wsUrl);
      console.log('[mtapi] copied:', wsUrl);
    } else {
      var ta = document.createElement('textarea');
      ta.value = wsUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      console.log('[mtapi] copied (execCommand):', wsUrl);
    }
  } catch(e) { console.log('[mtapi] copy err:', e.message); }
};


// Render any nested value as inline HTML (used INSIDE table cells)
function renderCell(v, depth){
  if(_isScalar(v)) return '<span class="'+classifyValue(v)+'">'+esc(cellStr(v))+'</span>';
  if(depth > 5) return '<code style="font-size:9px">'+esc(JSON.stringify(v).slice(0,100))+'</code>';

  if(Array.isArray(v)){
    if(v.length === 0) return '<span class="empty">[]</span>';
    if(_isScalar(v[0])){
      return '<span style="font-size:10px">' +
        v.map(function(x){return '<code>'+esc(cellStr(x))+'</code>';}).join(' ') +
        '</span>';
    }
    if(Array.isArray(v[0])){
      var h = '<details class="sub"><summary>[['+v.length+']]</summary>';
      h += '<table style="font-size:10px;margin:2px 0"><tbody>';
      v.forEach(function(row){
        h += '<tr>';
        row.forEach(function(cell){
          h += '<td style="padding:2px 4px;border:none">'+esc(cellStr(cell))+'</td>';
        });
        h += '</tr>';
      });
      return h + '</tbody></table></details>';
    }
    var cols = [], seen = {};
    v.forEach(function(o){
      if(o && typeof o==='object' && !Array.isArray(o)){
        Object.keys(o).forEach(function(k){
          if(!seen[k]){ seen[k]=true; cols.push(k); }
        });
      }
    });
    var h = '<details class="sub"><summary>[{'+v.length+'}]</summary>';
    h += '<table style="font-size:10px;margin:2px 0"><thead><tr>';
    cols.forEach(function(c){
      h += '<th style="padding:2px 4px;font-size:9px">'+esc(c)+'</th>';
    });
    h += '</tr></thead><tbody>';
    v.forEach(function(row){
      h += '<tr>';
      cols.forEach(function(c){
        var cell = row ? row[c] : undefined;
        h += '<td style="padding:2px 4px;border:none">' + renderCell(cell, depth+1) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></details>';
    return h;
  }

  if(typeof v === 'object'){
    var n = Object.keys(v).length;
    var h = '<details class="sub"><summary>{'+n+'}</summary>';
    h += '<table class="kv" style="font-size:10px;margin:2px 0"><tbody>';
    Object.keys(v).forEach(function(k){
      var val = v[k];
      h += '<tr><th style="padding:2px 4px;font-size:9px;width:30%">'+esc(k)+'</th>' +
           '<td style="padding:2px 4px">' + renderCell(val, depth+1) + '</td></tr>';
    });
    h += '</tbody></table></details>';
    return h;
  }
  return esc(cellStr(v));
}

// Top-level object renderer
function renderObj(obj, depth){
  var keys = Object.keys(obj);
  if(!keys.length) return '<span class="empty">{}</span>';

  var scalars = [], nested = [];
  keys.forEach(function(k){
    var v = obj[k];
    if(_isScalar(v)) scalars.push({k:k, v:v});
    else nested.push({k:k, v:v});
  });

  var h = '';

  if(scalars.length){
    h += '<table class="kv"><tbody>';
    scalars.forEach(function(it){
      h += '<tr><th>'+esc(it.k)+'</th>'+_scalarCell(it.v)+'</tr>';
    });
    h += '</tbody></table>';
  }

  nested.forEach(function(it){
    var k = it.k, v = it.v;
    var count = (Array.isArray(v)) ? v.length : Object.keys(v).length;
    var label = '▸ '+esc(k)+' ('+count+')';

    if(Array.isArray(v)){
      if(v.length === 0){
        h += '<details class="sub"><summary>'+label+'</summary>'+
             '<span class="empty">[]</span></details>';
      } else if(_isScalar(v[0])){
        h += '<details class="sub" open><summary>'+label+'</summary>'+
             '<div style="padding:4px 0 4px 12px">' + renderCell(v, depth+1) + '</div></details>';
      } else if(Array.isArray(v[0])){
        h += '<details class="sub"><summary>'+label+'</summary>'+
             '<div style="padding-left:12px">' + renderCell(v, depth+1) + '</div></details>';
      } else {
        var cols = [], seen = {};
        v.forEach(function(o){
          if(o && typeof o==='object' && !Array.isArray(o)){
            Object.keys(o).forEach(function(k2){
              if(!seen[k2]){ seen[k2]=true; cols.push(k2); }
            });
          }
        });
        h += '<details class="sub"><summary>'+label+'</summary>';
        h += '<table><thead><tr>';
        cols.forEach(function(c){ h += '<th>'+esc(c)+'</th>'; });
        h += '</tr></thead><tbody>';
        v.forEach(function(row){
          h += '<tr>';
          cols.forEach(function(c){
            var cell = row ? row[c] : undefined;
            h += '<td>' + renderCell(cell, depth+1) + '</td>';
          });
          h += '</tr>';
        });
        h += '</tbody></table></details>';
      }
    } else if(typeof v === 'object'){
      if(depth < 5){
        h += '<details class="sub"><summary>'+label+'</summary>';
        h += renderObj(v, depth+1);
        h += '</details>';
      } else {
        h += '<code style="font-size:10px">'+esc(JSON.stringify(v).slice(0,300))+'</code>';
      }
    }
  });

  return h;
}

function renderData(data){
  if(data === null || data === undefined) return '<div class="empty">null</div>';

  if(Array.isArray(data)){
    if(data.length === 0) return '<div class="empty">(empty array)</div>';
    if(_isScalar(data[0])) return '<div style="padding:4px 0">'+renderCell(data, 0)+'</div>';
    if(Array.isArray(data[0])) return renderCell(data, 0);

    var cols = [], seen = {};
    data.forEach(function(o){
      if(o && typeof o==='object' && !Array.isArray(o)){
        Object.keys(o).forEach(function(k){
          if(!seen[k]){ seen[k]=true; cols.push(k); }
        });
      }
    });
    var h = '<table><thead><tr>';
    cols.forEach(function(c){ h += '<th>'+esc(c)+'</th>'; });
    h += '</tr></thead><tbody>';
    data.forEach(function(row){
      h += '<tr>';
      cols.forEach(function(c){
        var cell = row ? row[c] : undefined;
        h += '<td>' + renderCell(cell, 1) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }

  if(typeof data === 'object') return renderObj(data, 0);
  return '<div class="scalar">'+esc(String(data))+'</div>';
}

// MTAPI_SEMAPHORE_78: soft queue so UI never exhausts WebView pool.
// updateStats uses `callDirect` (bypass) so header always loads.
var _inflight = 0;
var MAX_INFLIGHT = 3;
var _queue = [];
function _pumpQueue(){
  while (_inflight < MAX_INFLIGHT && _queue.length) {
    var fn = _queue.shift();
    fn();
  }
}

function callDirect(path) {
  // no queue — direct fetch, used by updateStats
  var sep=path.indexOf('?')>=0?'&':'?';
  var url=path+sep+'token='+encodeURIComponent(TOKEN);
  var nowFn = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
    ? function(){ return performance.now(); }
    : function(){ return Date.now(); };
  var t0 = nowFn();
  var ms = SLOW.has(path) ? 15000 : 10000;
  var ctl = null;
  var timer = null;
  var opts = {};
  if (typeof AbortController !== 'undefined') {
    try {
      ctl = new AbortController();
      opts.signal = ctl.signal;
      timer = setTimeout(function(){ try { ctl.abort(); } catch(e){} }, ms);
      if (timer && typeof timer.unref === 'function') timer.unref();
    } catch (e) { ctl = null; timer = null; }
  }
  return fetch(url, opts).then(function(r){return r.json()}).then(function(j){
    if (timer) clearTimeout(timer);
    return {ms: Math.round(nowFn()-t0), json: j};
  }).catch(function(e){
    if (timer) clearTimeout(timer);
    return {ms: Math.round(nowFn()-t0), error: String(e)};
  });
}

function call(path){
  return new Promise(function(resolve){
    var task = function(){
      _inflight++;
      var done = false;
      var finish = function(res){
        if (done) return;
        done = true;
        _inflight--;
        resolve(res);
        _pumpQueue();
      };
      try {
        callDirect(path).then(finish, function(e){
          finish({ms: 0, error: String(e)});
        });
      } catch (e) {
        finish({ms: 0, error: String(e)});
      }
    };
    if (_inflight < MAX_INFLIGHT) task();
    else _queue.push(task);
  });
}


// MTAPI_GUI: copy JSON endpoint'а в clipboard
// MTAPI_COPY_FILTER: рекурсивно фильтровать массивы в JSON по строковому совпадению
function _filterJsonByQuery(data, q) {
  if (!q) return data;
  var ql = q.toLowerCase();
  if (Array.isArray(data)) {
    var out = [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        var keys = Object.keys(item);
        var match = false;
        for (var j = 0; j < keys.length; j++) {
          var v = item[keys[j]];
          if (v == null) continue;
          if (typeof v === 'object') continue;
          if (String(v).toLowerCase().indexOf(ql) >= 0) { match = true; break; }
        }
        if (match) out.push(item);
      } else if (item && typeof item === 'object' && Array.isArray(item)) {
        var sub = _filterJsonByQuery(item, q);
        if (sub.length) out.push(sub);
      } else {
        if (item == null) continue;
        if (String(item).toLowerCase().indexOf(ql) >= 0) out.push(item);
      }
    }
    return out;
  }
  if (data && typeof data === 'object') {
    var outObj = {};
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      var val = data[k];
      if (Array.isArray(val)) {
        outObj[k] = _filterJsonByQuery(val, q);
      } else {
        outObj[k] = val;
      }
    }
    return outObj;
  }
  return data;
}

function _copyEndpointJson(ep) {
  var j = ep._lastJson;
  if (!j) return;
  // Активный .tbl-search → копируем только отфильтрованные строки
  var q = '';
  var inputs = ep.querySelectorAll('.tbl-search');
  for (var i = 0; i < inputs.length; i++) {
    var v = (inputs[i].value || '').trim();
    if (v) { q = v; break; }
  }
  var out = j;
  if (q) {
    if (j && typeof j === 'object' && 'data' in j) {
      out = Object.assign({}, j);
      out.data = _filterJsonByQuery(j.data, q);
    } else {
      out = _filterJsonByQuery(j, q);
    }
    console.log('[mtapi] copy filtered by "' + q + '"');
  }
  var text = JSON.stringify(out, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function(){
      console.log('[mtapi] copied ' + text.length + 'b');
    }).catch(function(){ _copyFallback(text); });
  } else {
    _copyFallback(text);
  }
}

// MTAPI_GUI: счётчик успешных/ошибочных в группе

// MTAPI_UPTIME_REFRESH: обновление uptime при раскрытии секции
function _attachUptimeRefresh(body) {
  if (!body) return;
  var sub = body.querySelector('#uptime-sub');
  if (!sub) return;
  if (sub.dataset.bound === '1') return;
  sub.dataset.bound = '1';
  sub.addEventListener('toggle', function(){
    if (!sub.open) return;
    var pre = sub.querySelector('#uptime-pre');
    if (!pre) return;
    if (sub.dataset.refreshing === '1') return;
    sub.dataset.refreshing = '1';
    _fetch('/debug?token=' + encodeURIComponent(TOKEN))
      .then(function(r){ return r.json(); })
      .then(function(j){
        var data = (j && j.data) ? j.data : j;
        if (data && data.uptime) pre.textContent = String(data.uptime);
      })
      .catch(function(){})
      .finally(function(){ sub.dataset.refreshing = ''; });
  });
}

// MTAPI_REFRESH_ON_TOGGLE: универсальное обновление секций /debug при раскрытии
// Секции помечены data-refresh-field="<field>" → pre.textContent из data[field]
function _attachRefreshOnToggle(root) {
  if (!root) return;
  var secs = root.querySelectorAll('details[data-refresh-field]');
  for (var i = 0; i < secs.length; i++) {
    (function(d) {
      if (d.dataset.bound === '1') return;
      d.dataset.bound = '1';
      d.addEventListener('toggle', function() {
        if (!d.open) return;
        var field = d.dataset.refreshField;
        var pre = d.querySelector('.debug-pre');
        if (!pre || !field) return;
        if (d.dataset.refreshing === '1') return;
        d.dataset.refreshing = '1';
        _fetch('/debug?token=' + encodeURIComponent(TOKEN))
          .then(function(r) { return r.json(); })
          .then(function(j) {
            var data = (j && j.data) ? j.data : j;
            if (data && data[field] !== undefined && data[field] !== null) {
              pre.textContent = String(data[field]);
            }
          })
          .catch(function() {})
          .finally(function() { d.dataset.refreshing = ''; });
      });
    })(secs[i]);
  }
}

// MTAPI_PROC_ALL_REFRESH: обновить Processes (all) при раскрытии (нативный Android.processList)
function _attachProcessesAllRefresh(root) {
  if (!root) return;
  var d = root.querySelector('#processes-all-sub');
  if (!d || d.dataset.bound === '1') return;
  d.dataset.bound = '1';
  d.addEventListener('toggle', function() {
    if (!d.open) return;
    if (typeof Android === 'undefined' || typeof Android.processList !== 'function') return;
    try {
      var pre = d.querySelector('#processes-all');
      if (pre) pre.textContent = Android.processList();
    } catch(e) { console.log('[mtapi] processes-all refresh err:', e.message); }
  });
}

function _updateGroupCounter(gd) {
  if (!gd) return;
  var h = gd.querySelector('.group-h');
  if (!h) return;
  var base = gd.dataset.group || '';
  var eps = gd.querySelectorAll('.ep');
  var total = eps.length, ok = 0, err = 0;
  for (var i = 0; i < eps.length; i++) {
    var st = eps[i].querySelector('.status');
    if (!st) continue;
    if (st.classList.contains('ok')) ok++;
    else if (st.classList.contains('err')) err++;
  }
  var tail = '';
  if (ok + err > 0) {
    if (err === 0) tail = ' \u2014 ' + ok + '/' + total + ' \u2713';
    else tail = ' \u2014 ' + ok + '/' + total + ', ' + err + ' \u2717';
  }
  h.textContent = base + ' (' + total + ')' + tail;
}


// MTAPI_TABLE_SEARCH: search + подсветка для таблиц с большими данными
// Автоматически появляется при > 15 строк. Работает как logcat.
function _attachAllTableSearch(root) {
  if (!root) return;
  var tables = root.querySelectorAll('table');
  for (var i = 0; i < tables.length; i++) {
    _attachTableSearch(tables[i]);
  }
}

function _attachTableSearch(tbl) {
  if (tbl.dataset.searchAttached === '1') return;
  tbl.dataset.searchAttached = '1';
  var rows = tbl.querySelectorAll('tbody > tr');
  if (rows.length < 15) return; // мало строк — не нужно
  // Не дублировать если уже есть toolbar
  if (tbl.previousElementSibling &&
      tbl.previousElementSibling.classList &&
      tbl.previousElementSibling.classList.contains('tbl-toolbar')) {
    return;
  }

  var wrap = document.createElement('div');
  wrap.className = 'tbl-toolbar';
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'tbl-search';
  input.placeholder = 'filter ' + rows.length + ' rows\u2026';
  input.setAttribute('title', '\uD83D\uDD0D Filter table rows (case-insensitive)');
  var status = document.createElement('span');
  status.className = 'tbl-status';
  status.textContent = rows.length + '/' + rows.length;
  wrap.appendChild(input);
  wrap.appendChild(status);
  tbl.parentNode.insertBefore(wrap, tbl);

  var timer = null;
  input.addEventListener('input', function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null;
      _filterTable(tbl, input.value, status);
    }, 150);
  });
}

function _filterTable(tbl, query, statusEl) {
  var q = (query || '').trim().toLowerCase();
  var rows = tbl.querySelectorAll('tbody > tr');
  var visible = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var text = row.getAttribute('data-search-text');
    if (text === null) {
      text = row.textContent || '';
      row.setAttribute('data-search-text', text);
    }
    var match = !q || text.toLowerCase().indexOf(q) >= 0;
    row.style.display = match ? '' : 'none';
    if (match) visible++;

    var cells = row.querySelectorAll('td, th');
    for (var j = 0; j < cells.length; j++) {
      _applyCellHighlight(cells[j], q);
    }
  }
  if (statusEl) statusEl.textContent = visible + '/' + rows.length;
  // Обновить title copy-кнопки — чтобы было видно, что копируется
  var ep = tbl.closest ? tbl.closest('.ep') : null;
  var copyBtn = ep ? ep.querySelector('.copy') : null;
  if (copyBtn) {
    copyBtn.title = q ? ('copy ' + visible + ' filtered rows (of ' + rows.length + ')') : 'copy raw JSON';
  }
}

function _applyCellHighlight(cell, q) {
  var orig = cell.getAttribute('data-orig-html');
  if (orig === null) {
    orig = cell.innerHTML;
    cell.setAttribute('data-orig-html', orig);
  }
  if (cell.innerHTML !== orig) cell.innerHTML = orig;
  if (q) _highlightTree(cell, q);
}

// Обёрнуть совпадения в <mark class="tbl-hl"> (walk по text nodes)
function _highlightTree(root, q) {
  if (!q) return;
  var ql = q.toLowerCase();
  if (typeof document.createTreeWalker !== 'function') return;
  var walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */, null);
  var nodes = [];
  var n;
  while ((n = walker.nextNode()) !== null) nodes.push(n);
  for (var k = 0; k < nodes.length; k++) {
    var tn = nodes[k];
    var t = tn.nodeValue;
    if (!t) continue;
    var low = t.toLowerCase();
    if (low.indexOf(ql) < 0) continue;
    var parent = tn.parentNode;
    var frag = document.createDocumentFragment();
    var idx = 0;
    while (true) {
      var pos = low.indexOf(ql, idx);
      if (pos < 0) {
        if (idx < t.length) frag.appendChild(document.createTextNode(t.slice(idx)));
        break;
      }
      if (pos > idx) frag.appendChild(document.createTextNode(t.slice(idx, pos)));
      var mark = document.createElement('mark');
      mark.className = 'tbl-hl';
      mark.textContent = t.slice(pos, pos + ql.length);
      frag.appendChild(mark);
      idx = pos + ql.length;
    }
    parent.replaceChild(frag, tn);
  }
}

// MTAPI_PROC_SEARCH: search + подсветка для <pre id="processes-all">
function _attachProcSearch(pre) {
  if (!pre || pre.dataset.searchAttached === '1') return;
  pre.dataset.searchAttached = '1';
  var lines = (pre.textContent || '').split('\n');
  if (lines.length < 10) return;

  // превратить в .logcat-line спаны
  var html = '';
  for (var i = 0; i < lines.length; i++) {
    html += '<span class="proc-line">' + esc(lines[i]) + '</span>\n';
  }
  pre.innerHTML = html;

  var wrap = document.createElement('div');
  wrap.className = 'tbl-toolbar';
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'proc-search';
  input.placeholder = 'filter ' + lines.length + ' processes\u2026';
  var status = document.createElement('span');
  status.className = 'tbl-status';
  status.textContent = lines.length + '/' + lines.length;
  wrap.appendChild(input);
  wrap.appendChild(status);
  pre.parentNode.insertBefore(wrap, pre);

  var timer = null;
  input.addEventListener('input', function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null;
      var spans = pre.querySelectorAll('.proc-line');
      var q = (input.value || '').trim().toLowerCase();
      var visible = 0;
      for (var i = 0; i < spans.length; i++) {
        var sp = spans[i];
        var orig = sp.getAttribute('data-orig');
        if (orig === null) {
          orig = sp.textContent || '';
          sp.setAttribute('data-orig', orig);
        }
        var match = !q || orig.toLowerCase().indexOf(q) >= 0;
        sp.style.display = match ? '' : 'none';
        if (match) {
          visible++;
          if (q) {
            sp.innerHTML = _highlightString(orig, q);
          } else {
            sp.innerHTML = esc(orig);
          }
        }
      }
      status.textContent = visible + '/' + spans.length;
    }, 150);
  });
}

// Строковая подсветка (как logcat, но класс .tbl-hl)
function _highlightString(text, query) {
  if (!query) return esc(text);
  var lower = text.toLowerCase();
  var q = query.toLowerCase();
  var out = '';
  var idx = 0, pos, n = 0;
  while ((pos = lower.indexOf(q, idx)) !== -1) {
    out += esc(text.slice(idx, pos));
    out += '<mark class="tbl-hl">' + esc(text.slice(pos, pos + q.length)) + '</mark>';
    idx = pos + q.length;
    n++;
    if (n > 500) break;
  }
  out += esc(text.slice(idx));
  return out;
}


function makeCard(path){
  var ep=document.createElement('details');
  ep.className='ep'; ep.dataset.path=path;
  var head=document.createElement('summary'); head.className='ep-h';
  var btn=document.createElement('button'); btn.className='run'; btn.textContent='GET '+path; btn.title='Click to fetch '+path+' (single request, no queue)';
  btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();run(ep,path)});
  var status=document.createElement('span'); status.className='status';
  var copy=document.createElement('button'); copy.className='copy';
  copy.textContent='\uD83D\uDCCB'; copy.title='copy raw JSON to clipboard';
  copy.style.display='none';
  copy.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    _copyEndpointJson(ep);
  });
  var toggle=document.createElement('button'); toggle.className='toggle';
  toggle.textContent='{ }'; toggle.title='toggle raw JSON';
  head.appendChild(btn); head.appendChild(status); head.appendChild(copy); head.appendChild(toggle);
  var body=document.createElement('div'); body.className='ep-b';
  ep.appendChild(head); ep.appendChild(body);
  return ep;
}

function run(ep,path){
  var status=ep.querySelector('.status');
  var body=ep.querySelector('.ep-b');
  var toggle=ep.querySelector('.toggle');
  ep.open=true;
  status.className='status loading'; status.innerHTML='<span class="spin"></span>';
  body.innerHTML='<div class="empty">loading…</div>';
  call(path).then(function(res){
    var copyBtn = ep.querySelector('.copy');
    var grp = ep.closest ? ep.closest('.group') : null;
    function _done(){ if (grp) _updateGroupCounter(grp); }
    if(res.error){
      ep.classList.add('ep-err');
      status.className='status err'; status.textContent=res.ms+'ms';
      body.innerHTML='<div class="empty" style="color:var(--err)">'+esc(res.error)+'</div>';
      toggle.style.display='none'; if (copyBtn) copyBtn.style.display='none';
      _done(); return;
    }
    var j=res.json;
    if(j&&j.ok===false){
      ep.classList.add('ep-err');
      status.className='status err'; status.textContent=res.ms+'ms';
      body.innerHTML='<div class="empty" style="color:var(--err)">error: '+esc(j.error||'unknown')+'</div>';
      toggle.style.display='none'; if (copyBtn) copyBtn.style.display='none';
      _done(); return;
    }
    ep.classList.remove('ep-err');
    ep._lastJson = j;
    status.className='status ok'; status.textContent=res.ms+'ms';
    var data=(j&&('data'in j))?j.data:j;
    body.innerHTML=renderData(data);
    var raw=document.createElement('details'); raw.className='raw';
    var sum=document.createElement('summary'); sum.textContent='raw JSON';
    var pre=document.createElement('pre'); pre.textContent=JSON.stringify(j,null,2);
    raw.appendChild(sum); raw.appendChild(pre); body.appendChild(raw);
    toggle.style.display='';
    toggle.onclick=function(){raw.open=!raw.open;};
    if (copyBtn) copyBtn.style.display='';
    _attachAllTableSearch(body);
    _done();
  });
}


// MTAPI_172: safe getElementById
function _el(id) { return (typeof document !== 'undefined') ? document.getElementById(id) : null; }

function render(){
  var _perfT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var qEl=document.getElementById('q'); var q=qEl?qEl.value.toLowerCase():'';
  var main=document.getElementById('main'); if(!main)return; main.innerHTML='';
  for(var gi=0;gi<ENDPOINTS.length;gi++){
    var g=ENDPOINTS[gi];
    var filtered=g.eps.filter(function(p){return p.toLowerCase().indexOf(q)>=0});
    if(filtered.length===0)continue;
    var gd=document.createElement('details');
    gd.className='group'; gd.dataset.group=g.group; gd.open=false;
    var h=document.createElement('summary'); h.className='group-h';
    h.textContent=g.group+' ('+filtered.length+')'; h.title=g.group+': '+filtered.length+' endpoint'+(filtered.length!==1?'s':'')+' (click to expand/collapse)';
    gd.appendChild(h);
    gd.addEventListener('toggle', function(){ _updateGroupCounter(gd); });
    for(var pi=0;pi<filtered.length;pi++)gd.appendChild(makeCard(filtered[pi]));
    main.appendChild(gd);
  }

  // Debug section moved to mtapi-debug.js overlay (FAB, top-right).
  // Old in-page debug group removed in v2.2.0. See mtapi-debug.js.

  // MTAPI_PERF: замер render()
  var _perfT1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  window._perf = window._perf || {};
  window._perf.render = Math.round(_perfT1 - _perfT0);
}

// ─── updateStats (с _statsBusy-guard) ────────────────
var _statsBusy=false;
function updateStats(){
  if (_statsBusy) return;
  _statsBusy = true;
  var pending = 2;
  var done = function(){ if (--pending === 0) _statsBusy = false; };
  callDirect('/battery').then(function(r){
    done();
    if(r.json&&r.json.data){
      var b=r.json.data;
      var pct=b.percentage||0;
      var cls=pct>60?'pct-hi':pct>20?'pct-md':'pct-lo';
      (_el('st-batt')||{}).innerHTML=
        'battery <b>'+pct+'%</b>'+(b.charging?' ⚡':'')+
        '<span class="bar"><i class="'+cls+'" style="width:'+pct+'%"></i></span>';
    } else {
      (_el('st-batt')||{}).innerHTML='battery <b style="color:var(--err)">?</b>';
    }
  });
  callDirect('/system').then(function(r){
    done();
    if(r.json&&r.json.data&&r.json.data.ram){
      var rm=r.json.data.ram;
      var used=rm.totalBytes-rm.availableBytes;
      var pct=Math.round(used/rm.totalBytes*100);
      var cls=pct>85?'pct-lo':pct>70?'pct-md':'pct-hi';
      (_el('st-ram')||{}).innerHTML=
        'ram <b>'+pct+'%</b><span class="bar"><i class="'+cls+'" style="width:'+pct+'%"></i></span>';
    } else {
      (_el('st-ram')||{}).innerHTML='ram <b style="color:var(--err)">?</b>';
    }
  });
}

// ─── live toggle (упрощён, без утечки таймера) ────────
var liveOn=false, liveTimer=null;
function setLive(on){
  liveOn = on;
  // MTAPI_NOBUTTONS: live button removed → liveEl больше не нужен
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  if (typeof window !== 'undefined' && window._statsTimer) {
    clearInterval(window._statsTimer);
    window._statsTimer = null;
  }
  if (on) {
    liveTimer = setInterval(updateStats, 5000);
    if (liveTimer && typeof liveTimer.unref === 'function') liveTimer.unref();
    if (typeof window !== 'undefined') window._statsTimer = liveTimer;
  }
}

// ─── theme ───────────────────────────────────────────
var savedTheme=localStorage.getItem('mtapi-theme');
if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', savedTheme || 'dark');
function updateThemeBtn(){
  var cur=document.documentElement.getAttribute('data-theme') || 'dark';
  var themeEl=document.getElementById('theme'); if(themeEl)themeEl.textContent=cur==='light'?'\u2600\uFE0F':'\uD83C\uDF19';
}
if (_el('theme')) _el('theme').addEventListener('click',function(){
  var cur=document.documentElement.getAttribute('data-theme') || 'dark';
  var next=cur==='light'?'dark':'light';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('mtapi-theme',next);
  updateThemeBtn();
});


// search (debounced — не пересоздаём DOM на каждый символ)
var qEl2=(typeof document !== 'undefined') ? document.getElementById('q') : null;
if (qEl2) {
  var _qTimer = null;
  qEl2.addEventListener('input', function(){
    if (_qTimer) clearTimeout(_qTimer);
    _qTimer = setTimeout(function(){ _qTimer = null; render(); }, 200);
  });
}

// MTAPI_NOBUTTONS: reset button removed

// live toggle removed

// init
if (typeof document !== 'undefined') {
render();
try {
  var m = document.getElementById("main");
  document.title = document.title + " R:" + (m ? m.innerHTML.length : -1);
} catch(e) {}


updateThemeBtn();
updateStats();
// setLive removed
} // MTAPI_242: DOM init


// kill any old SW
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(regs){
    regs.forEach(function(r){ r.unregister(); });
  }).catch(function(){});
}
// MTAPI_HARD_RESET_77: очистить все кэши (unregister() их не трогает)
if (typeof caches !== 'undefined' && caches.keys) {
  caches.keys().then(function(keys){
    keys.forEach(function(k){ caches.delete(k); });
  }).catch(function(){});
}

console.log('[mtapi] MTAPI_HARD_RESET_76 loaded');

var STATIC_ENDPOINTS = [
  '/contacts', '/calllog', '/sms',
  '/app/list', '/app/launch',
  '/locale', '/kernel', '/features',
  '/camera/list',
  '/calendar', '/alarm/next',
  '/tts/voices'
];

function isStatic(path) {
  for (var i = 0; i < STATIC_ENDPOINTS.length; i++) {
    if (path.indexOf(STATIC_ENDPOINTS[i]) === 0) return true;
  }
  return false;
}


// MTAPI_255: debug card — как endpoint, но с подотделами
function makeDebugCard() {
  var ep = document.createElement('details');
  ep.className = 'ep';
  ep.dataset.path = '/debug';
  ep.open = false;

  var head = document.createElement('summary');
  head.className = 'ep-h';

  var btn = document.createElement('button');
  btn.className = 'run';
  btn.textContent = 'GET /debug'; btn.title = 'Debug info: processes, port, uptime, memory, logcat, errors';
  btn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    ep.open = true;
    loadDebugCard(ep);
  });

  var status = document.createElement('span');
  status.className = 'status';
  status.textContent = 'loading…';

  head.appendChild(btn);
  head.appendChild(status);

  head.addEventListener('click', function(e){
    if (e.target === btn) return;
    if (!ep.open) {
      ep.open = true;
      loadDebugCard(ep);
    }
  });

  var body = document.createElement('div');
  body.className = 'ep-b';
  body.innerHTML = '<div class="empty">click GET /debug to load</div>';

  ep.appendChild(head);
  ep.appendChild(body);

  ep.addEventListener('toggle', function(){
    if (!ep.open) {
      if (typeof _stopLogcatLive === 'function') _stopLogcatLive();
    } else {
      if (typeof _startLogcatLive === 'function') _startLogcatLive();
    }
  });

  return ep;
}

function loadDebugCard(ep) {
  var status = ep.querySelector('.status');
  var body = ep.querySelector('.ep-b');
  var t0 = Date.now();
  var _perfT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  status.className = 'status loading';
  status.innerHTML = '<span class="spin"></span>';

  _fetch('/debug?token=' + encodeURIComponent(TOKEN))
    .then(function(r){ return r.json(); })
    .then(function(j){
      var ms = Date.now() - t0;
      if (j && j.ok === false) {
        status.className = 'status err';
        status.textContent = ms + 'ms';
        body.innerHTML = '<div class="empty" style="color:var(--err)">' + esc(j.error || 'error') + '</div>';
        return;
      }
      status.className = 'status ok';
      status.textContent = ms + 'ms';
      var data = (j && j.data) ? j.data : j;
      var _perfT1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      body.innerHTML = renderDebugSections(data);
      window._perf = window._perf || {};
      window._perf.loadDebugCard = Math.round(_perfT1 - _perfT0);
      setTimeout(function(){ if (typeof window._updatePerfDisplay === 'function') window._updatePerfDisplay(); }, 0);
      // MTAPI_315: devtools
      setTimeout(function(){
        try {
          var status = body.querySelector('#devtools-status');
          var list = body.querySelector('#devtools-list');
          if (!status || !list) return;
          _fetch('/devtools/json?token=' + encodeURIComponent(TOKEN)).then(function(r){ return r.json(); }).then(function(j){
            if (j && j.ok === false) {
              status.textContent = 'DevTools: ' + (j.error || 'not available');
              status.style.color = 'var(--err)';
              return;
            }
            var pages = Array.isArray(j) ? j : (j.data || []);
            if (pages.length === 0) {
              status.textContent = 'DevTools: no pages (WebView debugging off)';
              status.style.color = 'var(--warn)';
              return;
            }
            status.textContent = 'DevTools: ' + pages.length + ' page(s)';
            status.style.color = 'var(--ok)';
            var html = '';
            pages.forEach(function(p, i){
              var url = (p.url || '').replace(/[<>]/g, '');
              var ws = (p.webSocketDebuggerUrl || '').replace(/[<>]/g, '');
              html += '<div style="margin:4px 0;padding:4px;background:var(--bg3);border-radius:4px">';
              html += '<b>#' + i + '</b> ' + (p.title || '(no title)') + '<br>';
              html += '<code style="font-size:10px">' + url + '</code><br>';
              if (ws) {
                // MTAPI_DEVTOOLS_BTN_FIX: data-* вместо inline onclick
                // (было сломано: onclick="window._openDevtools("ws://...")")
                html += '<button class="btn devtools-btn" data-action="devtools" data-ws="' + esc(ws) + '">DevTools</button> ';
                html += '<button class="btn devtools-btn" data-action="copy-ws" data-ws="' + esc(ws) + '">Copy WS</button> ';
                html += '<button class="btn devtools-btn" data-action="view-source" data-ws="' + esc(ws) + '">\uD83D\uDCC4 Sources</button>';
              }
              html += '</div>';
            });
            list.innerHTML = html;
            // MTAPI_DEVTOOLS_BTN_FIX: делегирование кликов (не inline onclick)
            var btns = list.querySelectorAll('.devtools-btn');
            for (var bi = 0; bi < btns.length; bi++) {
              (function(b){
                b.addEventListener('click', function(e){
                  e.preventDefault();
                  var action = b.getAttribute('data-action');
                  var ws = b.getAttribute('data-ws');
                  if (!ws) return;
                  if (action === 'devtools') {
                    if (typeof window._openDevtools === 'function') window._openDevtools(ws);
                  } else if (action === 'copy-ws') {
                    if (typeof window._copyDevtools === 'function') window._copyDevtools(ws);
                  } else if (action === 'view-source') {
                    if (typeof window._viewAppSource === 'function') window._viewAppSource();
                  }
                });
              })(btns[bi]);
            }
          }).catch(function(e){
            status.textContent = 'DevTools error: ' + e.message;
            status.style.color = 'var(--err)';
          });
        } catch(e) { console.log('[mtapi] devtools err:', e.message); }
      }, 300);
      try {
        if (typeof Android !== 'undefined' && Android.processList) {
          var pre = body.querySelector('#processes-all');
          if (pre) pre.textContent = Android.processList();
        }
      } catch(e) { console.log('[mtapi] processList err:', e.message); }
      setTimeout(function(){
        if (typeof window !== 'undefined' && typeof window.attachLogcatSearch === 'function') {
          window.attachLogcatSearch();
        } else if (typeof attachLogcatSearch === 'function') {
          attachLogcatSearch();
        }
      }, 100);
      setTimeout(function(){ if (window.attachJsLogSearch) window.attachJsLogSearch(); }, 100);
      setTimeout(function(){ _attachUptimeRefresh(body); }, 100);
      setTimeout(function(){
        _attachAllTableSearch(body);
        _attachRefreshOnToggle(body);
        _attachProcessesAllRefresh(body);
        var proc = body.querySelector('#processes-all');
        if (proc) _attachProcSearch(proc);
      }, 100);
      _startLogcatLive();
      ep.open = true;
    })
    .catch(function(e){
      var ms = Date.now() - t0;
      status.className = 'status err';
      status.textContent = ms + 'ms';
      body.innerHTML = '<div class="empty" style="color:var(--err)">' + esc(String(e)) + '</div>';
    });
}

function renderDebugSections(data) {
  if (typeof window !== "undefined") window._debugData = data;

  if (!data || typeof data !== 'object') {
    return '<div class="empty">no data</div>';
  }

  var h = '';

  // 1. Processes (ps -A | grep mtapi)
  if (data.processes) {
    h += '<details class="sub" data-refresh-field="processes">';
    h += '<summary title="ps -A | grep mtapi (обновляется при раскрытии)">Processes (ps -A | grep mtapi)</summary>';
    h += '<pre class="debug-pre" id="processes-pre">' + esc(String(data.processes)) + '</pre>';
    h += '</details>';
  }

  // 2. Port
  if (data.port) {
    h += '<details class="sub">';
    h += '<summary title="Порт, на котором слушает Go-сервер">Port 7788</summary>';
    h += '<pre class="debug-pre">' + esc(String(data.port)) + '</pre>';
    h += '</details>';
  }

  // 3. Uptime (обновляется при раскрытии)
  if (data.uptime) {
    h += '<details class="sub" id="uptime-sub">';
    h += '<summary title="Сколько секунд работает Go-сервер (обновляется при раскрытии)">Uptime</summary>';
    h += '<pre class="debug-pre" id="uptime-pre">' + esc(String(data.uptime)) + '</pre>';
    h += '</details>';
  }

  // 4. Memory (Go)
  if (data.memory) {
    h += '<details class="sub" data-refresh-field="memory">';
    h += '<summary title="Go runtime (обновляется при раскрытии)">Memory (Go)</summary>';
    h += '<pre class="debug-pre" id="memory-pre">' + esc(String(data.memory)) + '</pre>';
    h += '</details>';
  }

  // 5. Errors (FATAL / ANR)
  if (data.errors) {
    h += '<details class="sub" data-refresh-field="errors">';
    h += '<summary title="FATAL exception / ANR (обновляется при раскрытии)">Errors (FATAL / ANR)</summary>';
    h += '<pre class="debug-pre debug-errors" id="errors-pre">' + esc(String(data.errors)) + '</pre>';
    h += '</details>';
  }

  // 6. Processes (all) — ActivityManager
  h += '<details class="sub" id="processes-all-sub">';
  h += '<summary title="All processes через ActivityManager (обновляется при раскрытии)">Processes (all)</summary>';
  h += '<pre class="debug-pre" id="processes-all">loading…</pre>';
  h += '</details>';

  // 7. Logcat
  if (data.logcat) {
    var logcat = String(data.logcat);
    h += '<details class="sub" id="logcat-sub">';
    h += '<summary title="Android logcat, last 50 lines. Уровни V/D/I/W/E/F и search">Logcat (last 50)</summary>';
    h += '<div class="logcat-toolbar">';
    h += '<div class="logcat-levels">';
    ['V', 'D', 'I', 'W', 'E', 'F'].forEach(function(lvl){
      h += '<label class="logcat-lvl">';
      h += '<input type="checkbox" data-lvl="' + lvl + '" checked >';
      h += '<span class="lvl-' + lvl.toLowerCase() + '" title="' + esc(LOG_LEVEL_TITLES[lvl] || lvl) + '">' + lvl + '</span>';
      h += '</label>';
    });
    h += '</div>';
    h += '<input type="text" class="logcat-search" placeholder="search…" title="Search logcat">';
    h += '<button class="logcat-btn" onclick="reloadLogcat()" title="Reload">\u27F3</button>';
    h += '<button class="logcat-btn" style="margin-left:auto" onclick="window._copyLogcat()" title="Copy logcat">\uD83D\uDCCB</button>';
    h += '</div>';
    h += '<pre class="debug-pre logcat-pre" id="logcat-pre">' + renderLogcatLines(logcat) + '</pre>';
    h += '</details>';
  }

  // 8. JS Logs
  if (typeof window !== 'undefined' && window._jslogBuf) {
    var buf = window._jslogBuf;
    h += '<details class="sub" id="jslog-sub" open>';
    h += '<summary title="console.log/warn/error из app.js (без adb, без DevTools)">JS Logs (' + buf.length + ')</summary>';
    h += '<div class="logcat-toolbar">';
    h += '<div class="logcat-levels">';
    ['V', 'D', 'I', 'W', 'E', 'F'].forEach(function(lvl){
      h += '<label class="logcat-lvl"><input type="checkbox" data-lvl="' + lvl + '" class="jslog-lvl" checked><span class="lvl-' + lvl.toLowerCase() + '" title="' + esc(LOG_LEVEL_TITLES[lvl] || lvl) + '">' + lvl + '</span></label>';
    });
    h += '</div>';
    h += '<input type="text" class="logcat-search jslog-search" placeholder="search JS logs…">';
    h += '<button class="logcat-btn" onclick="window._copyJslog&&window._copyJslog()" title="Copy JS Logs">\uD83D\uDCCB</button>';
    h += '<button class="logcat-btn" onclick="window._jslogClear&&window._jslogClear()" title="Clear">\uD83D\uDDD1</button>';
    h += '</div>';
    h += '<pre class="debug-pre logcat-pre" id="jslog-pre">';
    for (var ji = buf.length - 1; ji >= 0; ji--) {
      var lv = buf[ji].lvl || 'log';
      var cls = 'logcat-line lvl-' + (lv === 'error' ? 'e' : lv === 'warn' ? 'w' : lv === 'info' ? 'i' : lv === 'debug' ? 'd' : 'v');
      var tstr = _fmtTime(buf[ji].t);
      var line = tstr + ' [' + lv + '] ' + buf[ji].m;
      h += '<span class="' + cls + '" data-orig="' + esc(line) + '">' + esc(line) + '</span>\n';
    }
    h += '</pre>';
    h += '</details>';
  }

  // 8.5 Errors (persistent)
  h += '<details class="sub" id="persist-errors-sub">';
  h += '<summary title="Ошибки, выжившие после reload (localStorage)">Errors (persistent)</summary>';
  h += '<div class="logcat-toolbar">';
  h += '<button class="logcat-btn" onclick="window._persistErrorsClear&&window._persistErrorsClear()" title="Clear">\uD83D\uDDD1 Clear</button>';
  h += '</div>';
  h += '<pre class="debug-pre" id="persist-errors-pre" style="max-height:200px;overflow:auto;color:var(--err)">';
  try {
    var _perrs2 = JSON.parse(localStorage.getItem('mtapi-errors') || '[]');
    h += _perrs2.map(function(e){ return _fmtTime(e.t) + ' [' + e.lvl + '] ' + esc(e.m); }).join('\n');
  } catch(e) {}
  h += '</pre>';
  h += '</details>';

  // 9. Console Eval (сразу под JS Logs)
  h += '<details class="sub" id="eval-sub">';
  h += '<summary title="Console eval — выполнить JS выражение">Console Eval</summary>';
  h += '<div class="logcat-toolbar">';
  h += '<input type="text" class="eval-input" placeholder="JS expression… (e.g. window._logcatLiveTimer)" style="flex:1;padding:3px 6px;font-size:12px;background:var(--bg3);color:var(--fg);border:1px solid var(--border);border-radius:3px;font-family:monospace">';
  h += '<button class="logcat-btn" onclick="window._evalConsole&&window._evalConsole()" title="Run">\u25B6 Run</button>';
  h += '<button class="logcat-btn" onclick="window._evalClear&&window._evalClear()" title="Clear">\uD83D\uDDD1</button>';
  h += '</div>';
  h += '<pre class="debug-pre" id="eval-output" style="max-height:200px;overflow:auto;font-size:11px">(нажмите \u25B6 Run)</pre>';
  h += '</details>';

  // 10. Performance
  if (typeof window !== 'undefined') {
    var p = window._perf || {};
    h += '<details class="sub" id="perf-sub">';
    h += '<summary title="Performance — замеры JS функций">Performance</summary>';
    h += '<div class="logcat-toolbar">';
    h += '<button class="logcat-btn" onclick="window._perfReset&&window._perfReset()" title="Reset">\uD83D\uDD04 Reset</button>';
    h += '</div>';
    h += '<pre class="debug-pre" id="perf-pre" style="max-height:200px;overflow:auto;font-size:11px">';
    h += 'render() : ' + (p.render != null ? p.render + 'ms' : '?') + '\n';
    h += 'reloadLogcat() : ' + (p.reloadLogcat != null ? p.reloadLogcat + 'ms' : '?') + '\n';
    h += 'loadDebugCard() : ' + (p.loadDebugCard != null ? p.loadDebugCard + 'ms' : '?') + '\n';
    h += '</pre>';
    h += '</details>';
  }

  // 11. DevTools
  h += '<details class="sub" id="devtools-sub">';
  h += '<summary title="WebView DevTools">\uD83D\uDD27 DevTools (встроенный)</summary>';
  h += '<div class="debug-devtools" style="padding:8px">';
  h += '<div id="devtools-status" style="font-size:12px;margin-bottom:6px">loading…</div>';
  h += '<div id="devtools-list" style="font-size:12px"></div>';
  h += '<div id="devtools-frame" style="margin-top:6px;border:1px solid var(--border);border-radius:4px;height:400px;overflow:auto;max-height:400px"></div>';
  h += '</div>';
  h += '</details>';

  return h || '<div class="empty">no debug info</div>';
}

function renderLogcatLines(logcat) {
  var lines = logcat.split('\n').reverse();
  var out = '';
  lines.forEach(function(line, i){
    var lvl = detectLogLevel(line);
    var cls = 'logcat-line lvl-' + lvl.toLowerCase();
    out += '<span class="' + cls + '" data-line="' + i + '">' + esc(line) + '</span>\n';
  });
  return out;
}

function detectLogLevel(line) {
  // logcat format: "10-20 12:34:56.789  PID  TID LEVEL TAG: message"
  // якорный regex — не ложно-срабатывает на "I" внутри текста сообщения
  var m = line.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+\d+\s+([VDIWEF])\s/);
  if (m) return m[1];
  if (/\bFATAL\b/.test(line)) return 'F';
  if (/\bERROR\b/.test(line)) return 'E';
  if (/\bWARN\b/.test(line)) return 'W';
  if (/\bDEBUG\b/.test(line)) return 'D';
  if (/\bINFO\b/.test(line)) return 'I';
  return 'V';
}

// MTAPI_LOGCAT_LIVE: logcat автообновляется каждые 3с (по умолчанию, без UI)
function _startLogcatLive() {
  if (typeof window === 'undefined') return;
  if (!_LOGCAT_LIVE_ENABLED) return;   // MTAPI_LOGCAT_LIVE_FLAG: disabled
  if (window._logcatLiveTimer) return;
  window._logcatLiveTimer = setInterval(function(){
    var pre = document.getElementById('logcat-pre');
    if (pre) reloadLogcat();
    else _stopLogcatLive();
  }, 3000);
}

function _stopLogcatLive() {
  if (typeof window === 'undefined') return;
  if (window._logcatLiveTimer) {
    clearInterval(window._logcatLiveTimer);
    window._logcatLiveTimer = null;
  }
}

function reloadLogcat() {
  var _perfT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var pre = document.getElementById('logcat-pre');
  if (!pre) return;
  if (window._logcatRefreshing) return;
  window._logcatRefreshing = true;
  var scrollTop = pre.scrollTop;
  var wasAtTop = scrollTop < 5;
  _fetch('/debug?token=' + encodeURIComponent(TOKEN))
    .then(function(r){ return r.json(); })
    .then(function(j){
      var data = (j && j.data) ? j.data : j;
      if (data.logcat) {
        pre.innerHTML = renderLogcatLines(String(data.logcat));
        pre.scrollTop = wasAtTop ? 0 : scrollTop;
        if (typeof window !== 'undefined' && typeof window.filterLogcat === 'function') {
          window.filterLogcat();
        } else if (typeof filterLogcat === 'function') {
          filterLogcat();
        }
      }
      // MTAPI_UPTIME_LIVE: uptime обновляется вместе с logcat (каждые 3с).
      // Надёжнее, чем toggle-listener (не зависит от event timing).
      if (data && data.uptime) {
        var upPre = document.getElementById('uptime-pre');
        if (upPre) {
          var next = String(data.uptime);
          if (upPre.textContent !== next) {
            upPre.textContent = next;
          }
        }
      }
    })
    .catch(function(){})
    .finally(function(){
      window._logcatRefreshing = false;
      var _perfT1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      window._perf = window._perf || {};
      window._perf.reloadLogcat = Math.round(_perfT1 - _perfT0);
      if (typeof window._updatePerfDisplay === 'function') window._updatePerfDisplay();
    });
}

// ─── MTAPI_140: exports для тестов (node) ───
if (typeof module !== 'undefined' && module.exports) {

  // MTAPI_291: beforeExit — очистка таймеров (для node --test)
  if (typeof process !== 'undefined' && process.on) {
    process.on('beforeExit', function() {
      if (typeof window !== "undefined" && window && window._logcatLiveTimer) {
        clearInterval(window._logcatLiveTimer);
        if (typeof window !== "undefined") window._logcatLiveTimer = null;
      }
      if (typeof window !== "undefined" && window && window._statsTimer) {
        clearInterval(window._statsTimer);
        if (typeof window !== "undefined") window._statsTimer = null;
      }
    });
  }

  module.exports = {
    render: typeof render === 'function' ? render : null,
    renderData: typeof renderData === 'function' ? renderData : null,
    renderObj: typeof renderObj === 'function' ? renderObj : null,
    renderCell: typeof renderCell === 'function' ? renderCell : null,
    makeCard: typeof makeCard === 'function' ? makeCard : null,
    run: typeof run === 'function' ? run : null,
    call: typeof call === 'function' ? call : null,
    esc: typeof esc === 'function' ? esc : null,
    _isScalar: typeof _isScalar === 'function' ? _isScalar : null,
    classifyValue: typeof classifyValue === 'function' ? classifyValue : null,
    cellStr: typeof cellStr === 'function' ? cellStr : null,
    ENDPOINTS: typeof ENDPOINTS !== 'undefined' ? ENDPOINTS : null,
    STATIC_ENDPOINTS: typeof STATIC_ENDPOINTS !== 'undefined' ? STATIC_ENDPOINTS : null,
    isStatic: typeof isStatic === 'function' ? isStatic : null,
    makeDebugCard: typeof makeDebugCard === 'function' ? makeDebugCard : null,
    loadDebugCard: typeof loadDebugCard === 'function' ? loadDebugCard : null,
    renderDebugSections: typeof renderDebugSections === 'function' ? renderDebugSections : null,
  };
}



// MTAPI_JSLOG_SEARCH: отдельный фильтр для JS Logs (не filterLogcat!)
// filterLogcat ищет #logcat-pre, а нам нужен #jslog-pre
if (typeof window !== 'undefined') {
  window.filterJsLog = function() {
    try {
      var searches = document.querySelectorAll('.jslog-search');
      if (!searches.length) return;
      var pre = document.getElementById('jslog-pre');
      if (!pre) return;
      var q = (searches[0].value || '').trim();
      var ql = q.toLowerCase();
      // MTAPI_JSLOG_LEVELS: учитывать уровни V/D/I/W/E/F
      var levels = {};
      document.querySelectorAll('.jslog-lvl').forEach(function(cb){
        levels[cb.dataset.lvl] = cb.checked;
      });
      var visible = 0, total = 0;
      var lines = pre.querySelectorAll('.logcat-line');
      for (var i = 0; i < lines.length; i++) {
        var span = lines[i];
        total++;
        var orig = span.getAttribute('data-orig');
        if (orig === null) {
          orig = span.textContent || '';
          span.setAttribute('data-orig', orig);
        }
        // Определить уровень из class
        var lvl = 'V';
        var cls = span.className || '';
        if (typeof cls === 'string') {
          var parts = cls.split(' ');
          for (var k = 0; k < parts.length; k++) {
            if (parts[k].indexOf('lvl-') === 0) lvl = parts[k].substring(4).toUpperCase();
          }
        }
        var matchLvl = levels[lvl] !== false;
        var matchSearch = !ql || orig.toLowerCase().indexOf(ql) >= 0;
        var show = matchLvl && matchSearch;
        span.style.display = show ? '' : 'none';
        if (show) visible++;
        if (ql && show) {
          span.innerHTML = (typeof window.highlightText === 'function') ? window.highlightText(orig, q) : esc(orig);
        } else if (show) {
          span.innerHTML = esc(orig);
        }
      }
      var status = document.querySelector('.jslog-status');
      if (status) status.textContent = visible + '/' + total;
    } catch(e) { console.log('[mtapi] filterJsLog ERROR:', e.message); }
  };

  window.attachJsLogSearch = function() {
    var searches = document.querySelectorAll('.jslog-search');
    for (var i = 0; i < searches.length; i++) {
      var s = searches[i];
      if (s.getAttribute('data-jsbound') === '1') continue;
      s.setAttribute('data-jsbound', '1');
      s.addEventListener('input', window.filterJsLog);
      s.addEventListener('keyup', window.filterJsLog);
    }
    var cbs = document.querySelectorAll('.jslog-lvl');
    for (var j = 0; j < cbs.length; j++) {
      var cb = cbs[j];
      if (cb.getAttribute('data-jsbound') === '1') continue;
      cb.setAttribute('data-jsbound', '1');
      cb.addEventListener('change', window.filterJsLog);
    }
  };
}



// MTAPI_BYID: safe getElementById (null guard, src-* и др.)
function _byId(id) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

// MTAPI_VIEW_SOURCE: просмотр app.js с Search/Select/Copy (Sources)
if (typeof window !== 'undefined') {
  window._viewAppSource = function() {
    try {
      var url = '/app.js?token=' + encodeURIComponent(TOKEN);
      _fetch(url).then(function(r){ return r.text(); }).then(function(text){
        window._src = text;
        var frame = document.getElementById('devtools-frame');
        if (!frame) { console.log('[mtapi] devtools-frame не найден'); return; }
        frame.style.height = '600px';
        frame.style.maxHeight = '600px';
        frame.style.overflow = 'hidden';
        setTimeout(function(){ try { frame.scrollIntoView({behavior:'smooth', block:'start'}); } catch(e) {} }, 100);
        frame.innerHTML =
          '<div style="display:flex;flex-direction:column;height:100%;background:#1a1a1a;overflow:hidden">' +
            '<div style="flex:0 0 auto;background:#2a2a2a;padding:6px;border-bottom:1px solid #555">' +
              '<input id="src-q" placeholder="search app.js…" style="width:180px;padding:3px 6px;font-size:12px;background:#111;color:#eee;border:1px solid #555;border-radius:3px">' +
              '<button id="src-select" class="logcat-btn" style="margin-left:4px">Select</button>' +
              '<button id="src-copy" class="logcat-btn" style="margin-left:4px">Copy</button>' +
              '<button id="src-download" class="logcat-btn" style="margin-left:4px">Download</button>' +
              '<span id="src-status" style="font-size:11px;color:#888;margin-left:8px"></span>' +
            '</div>' +
            '<pre id="src-pre" style="flex:1 1 auto;margin:0;padding:8px;overflow:auto;white-space:pre-wrap;word-wrap:break-word;font-size:11px;line-height:1.4;background:#1a1a1a;color:#ddd;scrollbar-width:thin"></pre>' +
          '</div>';

        var pre = _byId('src-pre');
        if (!pre) { console.log('[mtapi] src-pre не найден'); return; }
        pre.textContent = text;
        var st0 = _byId('src-status');
        if (st0) st0.textContent = text.length + 'b, ' + text.split('\n').length + ' lines';

        // Search
        var qEl = _byId('src-q');
        if (qEl) qEl.addEventListener('input', function(e){
          var q = (e.target.value || '').toLowerCase();
          if (!q) { pre.textContent = text; var st = _byId('src-status'); if (st) st.textContent = text.length + 'b'; return; }
          var out = '', idx = 0, n = 0, pos;
          var low = text.toLowerCase();
          while (true) {
            pos = low.indexOf(q, idx);
            if (pos < 0) { out += esc(text.slice(idx)); break; }
            out += esc(text.slice(idx, pos));
            out += '<mark style="background:#ffeb3b;color:#000;border-radius:2px">' + esc(text.slice(pos, pos + q.length)) + '</mark>';
            idx = pos + q.length;
            n++;
            if (n > 1000) break;
          }
          pre.innerHTML = out;
          var stEl2 = _byId('src-status');
          if (stEl2) stEl2.textContent = n + ' matches / ' + text.length + 'b';
        });

        // Select all
        var selEl = _byId('src-select');
        if (selEl) selEl.addEventListener('click', function(){
          var r = document.createRange();
          r.selectNodeContents(pre);
          var s = window.getSelection();
          s.removeAllRanges(); s.addRange(r);
        });

        // Copy
        var copyEl = _byId('src-copy');
        if (copyEl) copyEl.addEventListener('click', function(){
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function(){
              console.log('[mtapi] app.js copied ' + text.length + 'b');
              var stEl3 = _byId('src-status');
              if (stEl3) stEl3.textContent = 'copied ' + text.length + 'b';
            }).catch(function(){ _copyFallback(text); });
          } else {
            _copyFallback(text);
          }
        });

        // Download
        var dlEl = _byId('src-download');
        if (dlEl) dlEl.addEventListener('click', function(){
          try {
            var blob = new Blob([text], {type: 'text/javascript'});
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'app.js';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            console.log('[mtapi] app.js downloaded');
          } catch(e) { console.log('[mtapi] download err: ' + e.message); }
        });

        console.log('[mtapi] view app.js: ' + text.length + 'b');
      }).catch(function(e){
        console.log('[mtapi] view app.js fetch err: ' + e.message);
      });
    } catch(e) { console.log('[mtapi] _viewAppSource err: ' + e.message); }
  };
}

// MTAPI_INSPECT_DOM: Elements — список всех id/class в документе
if (typeof window !== 'undefined') {
  window._inspectDom = function() {
    try {
      var pre = document.getElementById('dom-pre');
      if (!pre) { console.log('[mtapi] dom-pre не найден'); return; }
      var all = document.querySelectorAll('[id], [class]');
      var lines = [];
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var tag = el.tagName.toLowerCase();
        var id = el.id ? '#' + el.id : '';
        var cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean).join('.') : '';
        var indent = '';
        var p = el.parentElement;
        while (p && p !== document.body) { indent += '  '; p = p.parentElement; }
        lines.push(indent + tag + id + cls);
      }
      pre.textContent = lines.join('\n');
      console.log('[mtapi] DOM inspected: ' + lines.length + ' elements');
    } catch(e) { console.log('[mtapi] _inspectDom err: ' + e.message); }
  };

  window._copyDom = function() {
    try {
      var pre = document.getElementById('dom-pre');
      if (!pre) return;
      var text = pre.textContent || '';
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){
          console.log('[mtapi] DOM copied ' + text.length + 'b');
        }).catch(function(){ _copyFallback(text); });
      } else { _copyFallback(text); }
    } catch(e) { console.log('[mtapi] _copyDom err: ' + e.message); }
  };
}

// MTAPI_SHOW_STORAGE: Application — localStorage, sessionStorage, caches
if (typeof window !== 'undefined') {
  window._showStorage = function() {
    try {
      var pre = document.getElementById('storage-pre');
      if (!pre) return;
      var lines = [];
      try {
        lines.push('═══ localStorage (' + localStorage.length + ') ═══');
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          var v = localStorage.getItem(k);
          lines.push('  ' + k + ' = ' + (v && v.length > 200 ? v.slice(0, 200) + '...(' + v.length + 'b)' : v));
        }
      } catch(e) { lines.push('localStorage error: ' + e.message); }
      lines.push('');
      try {
        lines.push('═══ sessionStorage (' + sessionStorage.length + ') ═══');
        for (var j = 0; j < sessionStorage.length; j++) {
          var k2 = sessionStorage.key(j);
          var v2 = sessionStorage.getItem(k2);
          lines.push('  ' + k2 + ' = ' + (v2 && v2.length > 200 ? v2.slice(0, 200) + '...' : v2));
        }
      } catch(e) { lines.push('sessionStorage error: ' + e.message); }
      pre.textContent = lines.join('\n');
      if (typeof caches !== 'undefined' && caches.keys) {
        caches.keys().then(function(keys){
          var tail = ['', '═══ caches (' + keys.length + ') ═══'];
          keys.forEach(function(k){ tail.push('  ' + k); });
          pre.textContent = pre.textContent + '\n' + tail.join('\n');
        }).catch(function(){});
      }
      console.log('[mtapi] storage: ' + lines.length + ' lines');
    } catch(e) { console.log('[mtapi] _showStorage err: ' + e.message); }
  };
}

// MTAPI_COPY_JSLOG: копировать видимые JS Logs (как _copyLogcat)
if (typeof window !== 'undefined') {
  window._copyJslog = function() {
    try {
      var pre = document.getElementById('jslog-pre');
      if (!pre) { alert('jslog-pre не найден'); return; }
      var lines = pre.querySelectorAll('.logcat-line');
      var visible = [];
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].style.display === 'none') continue;
        var orig = lines[i].getAttribute('data-orig');
        if (orig === null) orig = lines[i].textContent || '';
        visible.push(orig);
      }
      var text = visible.length ? visible.join('\n') : (pre.textContent || pre.innerText || '');
      if (!text) { alert('jslog пуст'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){
          console.log('[mtapi] jslog copied ' + text.length + 'b (' + visible.length + ' lines)');
        }).catch(function(){ _copyFallback(text); });
      } else {
        _copyFallback(text);
      }
    } catch(e) { alert('error: ' + e.message); }
  };
}

// MTAPI_CONSOLE_EVAL: eval JS в /debug
if (typeof window !== 'undefined') {
  window._evalConsole = function() {
    try {
      var inp = document.querySelector('.eval-input');
      if (!inp) return;
      var cmd = (inp.value || '').trim();
      if (!cmd) return;
      var result, out;
      try {
        var _evalFn = window['eval'] || eval;
        result = _evalFn(cmd); // MTAPI_EVAL_ALLOW: user-typed console eval
      } catch(e) {
        out = 'Error: ' + e.message + (e.stack ? '\n' + e.stack : '');
        var preE = document.getElementById('eval-output');
        if (preE) preE.textContent = out;
        console.log('[eval] ' + cmd + ' → ' + out);
        return;
      }
      try {
        out = (result === undefined) ? 'undefined'
            : (result === null) ? 'null'
            : (typeof result === 'object') ? JSON.stringify(result, null, 2)
            : String(result);
      } catch(e2) {
        out = String(result);
      }
      var pre = document.getElementById('eval-output');
      if (pre) pre.textContent = out;
      console.log('[eval] ' + cmd + ' → ' + (out || '').slice(0, 200));
    } catch(e) {
      console.log('[mtapi] _evalConsole err: ' + e.message);
    }
  };
  window._evalClear = function() {
    var pre = document.getElementById('eval-output');
    if (pre) pre.textContent = '(нажмите ▶ Run)';
  };
}

// MTAPI_PERF: update display
if (typeof window !== 'undefined') {
  window._updatePerfDisplay = function() {
    var pre = document.getElementById('perf-pre');
    if (!pre) return;
    var p = (window._perf) ? window._perf : {};
    var r = (p.render != null ? p.render + 'ms' : '?');
    var l = (p.reloadLogcat != null ? p.reloadLogcat + 'ms' : '?');
    var d = (p.loadDebugCard != null ? p.loadDebugCard + 'ms' : '?');
    pre.textContent = 
      'render()        : ' + r + '\n' +
      'reloadLogcat()  : ' + l + '\n' +
      'loadDebugCard() : ' + d + '\n';
  };
}

// MTAPI_PERF: reset замеров (keep render)
if (typeof window !== 'undefined') {
  window._perfReset = function() {
    var keepRender = (window._perf) ? window._perf.render : null;
    window._perf = {};
    if (keepRender != null) window._perf.render = keepRender;
    if (typeof window._updatePerfDisplay === 'function') window._updatePerfDisplay();
    console.log('[mtapi] perf reset');
  };
}


// MTAPI_PERSIST_ERR: очистить persistent errors
if (typeof window !== 'undefined') {
  window._persistErrorsClear = function() {
    try { localStorage.removeItem('mtapi-errors'); } catch(e) {}
    var pre = (typeof _el === 'function') ? _el('persist-errors-pre') : null;
    if (pre) pre.textContent = '';
    console.log('[mtapi] persistent errors cleared');
  };
}

// MTAPI_JSLOG: очистить буфер
if (typeof window !== 'undefined') {
  window._jslogClear = function() {
    window._jslogBuf = [];
    var pre = document.getElementById('jslog-pre');
    if (pre) pre.innerHTML = '';
    console.log('[mtapi] jslog cleared');
  };
}

// MTAPI_287: window functions — с проверкой
if (typeof window !== 'undefined') {
  window.filterLogcat = function() {
    try {
      var searches = document.querySelectorAll('#logcat-sub .logcat-search');
      var pre = document.getElementById('logcat-pre');
      if (!pre) {
        var pres = document.querySelectorAll('.logcat-pre');
        if (pres.length > 0) pre = pres[0];
      }
      if (!searches.length || !pre) { return; }
      var q = (searches[0].value || '').trim();
      var ql = q.toLowerCase();
      var levels = {};
      document.querySelectorAll('#logcat-sub .logcat-lvl input').forEach(function(cb){
        levels[cb.dataset.lvl] = cb.checked;
      });
      var visible = 0, total = 0;
      var lines = pre.querySelectorAll('.logcat-line');
      for (var i = 0; i < lines.length; i++) {
        var span = lines[i];
        total++;
        var lvl = 'V';
        var cls = span.className || '';
        if (typeof cls === 'string') {
          var parts = cls.split(' ');
          for (var k = 0; k < parts.length; k++) {
            if (parts[k].indexOf('lvl-') === 0) lvl = parts[k].substring(4).toUpperCase();
          }
        }
        var orig = span.getAttribute('data-orig');
        if (orig === null) {
          orig = span.textContent || '';
          span.setAttribute('data-orig', orig);
        }
        var low = orig.toLowerCase();
        var matchLvl = levels[lvl] !== false;
        var matchSearch = !ql || low.indexOf(ql) >= 0;
        var show = matchLvl && matchSearch;
        span.style.display = show ? '' : 'none';
        if (show) visible++;
        if (ql && matchSearch) {
          span.innerHTML = window.highlightText(orig, q);
        } else {
          span.innerHTML = esc(orig);
        }
      }
      var status = document.querySelector('.logcat-status');
      if (status) {
        status.textContent = ql ? (visible + '/' + total + ' 🔍') : (visible + '/' + total);
      }
    } catch (e) {
      console.log('[mtapi] filterLogcat ERROR: ' + e.message);
    }
  };

  window.highlightText = function(text, query) {
    if (!query) return esc(text);
    var lower = text.toLowerCase();
    var q = query.toLowerCase();
    var out = '';
    var idx = 0;
    var pos;
    var n = 0;
    while ((pos = lower.indexOf(q, idx)) !== -1) {
      out += esc(text.slice(idx, pos));
      out += '<mark class="logcat-hl">' + esc(text.slice(pos, pos + q.length)) + '</mark>';
      idx = pos + q.length;
      n++;
      if (n > 500) break;
    }
    out += esc(text.slice(idx));
    return out;
  };

  window.attachLogcatSearch = function() {
    var searches = document.querySelectorAll('#logcat-sub .logcat-search');
    var bound = 0;
    for (var i = 0; i < searches.length; i++) {
      var s = searches[i];
      if (s.getAttribute('data-bound') === '1') continue;
      s.setAttribute('data-bound', '1');
      s.addEventListener('input', window.filterLogcat);
      s.addEventListener('keyup', window.filterLogcat);
      bound++;
    }
    var cbs = document.querySelectorAll('#logcat-sub .logcat-lvl input');
    for (var j = 0; j < cbs.length; j++) {
      var cb = cbs[j];
      if (cb.getAttribute('data-bound') === '1') continue;
      cb.setAttribute('data-bound', '1');
      cb.addEventListener('change', window.filterLogcat);
      bound++;
    }
  };
}
