if (typeof window === 'undefined') { globalThis.window = {}; }


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
if (typeof window !== "undefined") window._openDevtools = function(wsUrl) {
  try {
    var encoded = encodeURIComponent(wsUrl);
    if (typeof Android !== 'undefined' && Android.openDevtools) {
      Android.openDevtools(wsUrl);
      return;
    }
    var frame = document.getElementById('devtools-frame');
    if (frame) {
      var url = 'https://chrome-devtools-frontend.appspot.com/serve_file/@/inspector.html?ws=' + encoded;
      frame.innerHTML = '<iframe src="' + url + '" style="width:100%;height:100%;border:none"></iframe>';
    }
    console.log('[mtapi] devtools:', wsUrl);
  } catch(e) { console.log('[mtapi] openDevtools err:', e.message); }
};

// MTAPI_315: copy WebSocket URL
if (typeof window !== "undefined") window._copyDevtools = function(wsUrl) {
  try {
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

function makeCard(path){
  var ep=document.createElement('details');
  ep.className='ep'; ep.dataset.path=path;
  var head=document.createElement('summary'); head.className='ep-h';
  var btn=document.createElement('button'); btn.className='run'; btn.textContent='GET '+path; btn.title='Click to fetch '+path+' (single request, no queue)';
  btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();run(ep,path)});
  var status=document.createElement('span'); status.className='status';
  var toggle=document.createElement('button'); toggle.className='toggle';
  toggle.textContent='{ }'; toggle.title='toggle raw JSON';
  head.appendChild(btn); head.appendChild(status); head.appendChild(toggle);
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
    if(res.error){
      status.className='status err'; status.textContent=res.ms+'ms';
      body.innerHTML='<div class="empty" style="color:var(--err)">'+esc(res.error)+'</div>';
      toggle.style.display='none'; return;
    }
    var j=res.json;
    if(j&&j.ok===false){
      status.className='status err'; status.textContent=res.ms+'ms';
      body.innerHTML='<div class="empty" style="color:var(--err)">error: '+esc(j.error||'unknown')+'</div>';
      toggle.style.display='none'; return;
    }
    status.className='status ok'; status.textContent=res.ms+'ms';
    var data=(j&&('data'in j))?j.data:j;
    body.innerHTML=renderData(data);
    var raw=document.createElement('details'); raw.className='raw';
    var sum=document.createElement('summary'); sum.textContent='raw JSON';
    var pre=document.createElement('pre'); pre.textContent=JSON.stringify(j,null,2);
    raw.appendChild(sum); raw.appendChild(pre); body.appendChild(raw);
    toggle.style.display='';
    toggle.onclick=function(){raw.open=!raw.open;};
  });
}


// MTAPI_172: safe getElementById
function _el(id) { return (typeof document !== 'undefined') ? document.getElementById(id) : null; }

function render(){
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
    for(var pi=0;pi<filtered.length;pi++)gd.appendChild(makeCard(filtered[pi]));
    main.appendChild(gd);
  }

  var debugGroup = document.createElement('details');
  debugGroup.className = 'group';
  debugGroup.dataset.group = 'Debug';
  debugGroup.open = false;

  var debugHead = document.createElement('summary');
  debugHead.className = 'group-h';
  debugHead.textContent = 'Debug'; debugHead.title = 'Debug info: processes, port, uptime, memory, logcat (with filters), errors';
  debugGroup.appendChild(debugHead);

  debugGroup.appendChild(makeDebugCard());
  main.appendChild(debugGroup);
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
  var liveEl = document.getElementById('live');
  if (liveEl) liveEl.classList.toggle('on', on);
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

// reset
if (_el('reset')) _el('reset').addEventListener('click',function(){
  var btn = _el('reset');
  btn.textContent = '⟳ restarting…';
  btn.disabled = true;

  if (typeof Android !== 'undefined' && Android.restartApp) {
    console.log('[mtapi] full app restart (Android.restartApp)');
    setTimeout(function(){ Android.restartApp(); }, 200);
    return;
  }

  console.log('[mtapi] fallback: POST /restart');
  _fetch('/restart?token=' + encodeURIComponent(TOKEN), { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(j){ console.log('[mtapi] restart:', j); })
    .catch(function(e){ console.error('[mtapi] restart error:', e); })
    .finally(function(){
      setTimeout(function(){ location.reload(); }, 2000);
    });
});

// live toggle
if (_el('live')) _el('live').addEventListener('click',function(){setLive(!liveOn)});

// init
if (typeof document !== 'undefined') {
render();
try {
  var m = document.getElementById("main");
  document.title = document.title + " R:" + (m ? m.innerHTML.length : -1);
} catch(e) {}


updateThemeBtn();
updateStats();
setLive(false);
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
      body.innerHTML = renderDebugSections(data);
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
                var wsJs = JSON.stringify(ws).replace(/</g, '\\u003c');
                html += '<button class="btn" onclick="window._openDevtools(' + wsJs + ')">DevTools</button> ';
                html += '<button class="btn" onclick="window._copyDevtools(' + wsJs + ')">Copy WS</button>';
              }
              html += '</div>';
            });
            list.innerHTML = html;
          }).catch(function(e){
            status.textContent = 'DevTools error: ' + e.message;
            status.style.color = 'var(--err)';
          });
        } catch(e) { console.log('[mtapi] devtools err:', e.message); }
      }, 300);
      // MTAPI_313: processes-all
      try {
        if (typeof Android !== 'undefined' && Android.processList) {
          var pre = body.querySelector('#processes-all');
          if (pre) pre.textContent = Android.processList();
        }
      } catch(e) { console.log('[mtapi] processList err:', e.message); }
      setTimeout(attachLogcatSearch, 100);
      setTimeout(function(){ _attachUptimeRefresh(body); }, 100);
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

  // 1. Processes
  if (data.processes) {
    h += '<details class="sub">';
    h += '<summary title="ps -A | grep mtapi — какие процессы mtapi живы">Processes (ps -A | grep mtapi)</summary>';
    h += '<pre class="debug-pre">' + esc(String(data.processes)) + '</pre>';
    h += '</details>';
  }

  // 2. Port
  if (data.port) {
    h += '<details class="sub">';
    h += '<summary title="Порт, на котором слушает Go-сервер">Port 7788</summary>';
    h += '<pre class="debug-pre">' + esc(String(data.port)) + '</pre>';
    h += '</details>';
  }

  // 3. Uptime (обновляется при раскрытии — _attachUptimeRefresh)
  if (data.uptime) {
    h += '<details class="sub" id="uptime-sub">';
    h += '<summary title="Сколько секунд работает Go-сервер (с последнего restart). Обновляется при раскрытии.">Uptime</summary>';
    h += '<pre class="debug-pre" id="uptime-pre">' + esc(String(data.uptime)) + '</pre>';
    h += '</details>';
  }

  // 4. Memory
  if (data.memory) {
    h += '<details class="sub">';
    h += '<summary title="Go runtime: heap, sys, GC count">Memory (Go)</summary>';
    h += '<pre class="debug-pre">' + esc(String(data.memory)) + '</pre>';
    h += '</details>';
  }

  // 5. Logcat — search + levels
  if (data.logcat) {
    var logcat = String(data.logcat);

    h += '<details class="sub">';
    h += '<summary title="Android logcat, last 50 lines. Используй уровни V/D/I/W/E/F и search">Logcat (last 50)</summary>';

    h += '<div class="logcat-toolbar">';
    h += '<div class="logcat-levels">';
    ['V', 'D', 'I', 'W', 'E', 'F'].forEach(function(lvl){
      h += '<label class="logcat-lvl">';
      h += '<input type="checkbox" data-lvl="' + lvl + '" checked >';
      h += '<span class="lvl-' + lvl.toLowerCase() + '" title="' + esc(LOG_LEVEL_TITLES[lvl] || lvl) + '">' + lvl + '</span>';
      h += '</label>';
    });
    h += '</div>';
    h += '<input type="text" class="logcat-search" placeholder="search…" title="🔍 Search logcat text (case-insensitive)" >';
    h += '<button class="logcat-btn" onclick="reloadLogcat()" title="⟳ Reload /debug (manual)">⟳</button>';
    h += '<button class="logcat-btn" style="margin-left:auto" onclick="window._copyLogcat()" title="Copy logcat to clipboard">📋</button>';
    h += '</div>';

    h += '<pre class="debug-pre logcat-pre" id="logcat-pre">' + renderLogcatLines(logcat) + '</pre>';

    h += '</details>';
  }

  // 6. Errors (FATAL / ANR)
  if (data.errors) {
    h += '<details class="sub">';
    h += '<summary title="Критические: FATAL exception или ANR in dev.mtapi">Errors (FATAL / ANR)</summary>';
    h += '<pre class="debug-pre debug-errors">' + esc(String(data.errors)) + '</pre>';
    h += '</details>';
  }

  // MTAPI_313: processes-all
  h += '<details class="sub">';
  h += '<summary title="All processes (ActivityManager)">Processes (all)</summary>';
  h += '<pre class="debug-pre" id="processes-all">loading…</pre>';
  h += '</details>';

  // MTAPI_315: встроенный devtools (iframe)
  h += '<details class="sub">';
  h += '<summary title="WebView DevTools">🔧 DevTools (встроенный)</summary>';
  h += '<div class="debug-devtools" style="padding:8px">';
  h += '<div id="devtools-status" style="font-size:12px;margin-bottom:6px">loading…</div>';
  h += '<div id="devtools-list" style="font-size:12px"></div>';
  h += '<div id="devtools-frame" style="margin-top:6px;border:1px solid var(--border);border-radius:4px;height:400px;overflow:hidden"></div>';
  h += '</div>';
  h += '</details>';

  return h || '<div class="empty">no debug info</div>';
}

// MTAPI_260: logcat levels + search (единственная копия — дубликат удалён)
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
        filterLogcat();
      }
    })
    .catch(function(){})
    .finally(function(){ window._logcatRefreshing = false; });
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

// MTAPI_287: window functions — с проверкой
if (typeof window !== 'undefined') {
  window.filterLogcat = function() {
    try {
      var searches = document.querySelectorAll('.logcat-search');
      var pre = document.getElementById('logcat-pre');
      if (!pre) {
        var pres = document.querySelectorAll('.logcat-pre');
        if (pres.length > 0) pre = pres[0];
      }
      if (!searches.length || !pre) { return; }
      var q = (searches[0].value || '').trim();
      var ql = q.toLowerCase();
      var levels = {};
      document.querySelectorAll('.logcat-lvl input').forEach(function(cb){
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
    var searches = document.querySelectorAll('.logcat-search');
    var bound = 0;
    for (var i = 0; i < searches.length; i++) {
      var s = searches[i];
      if (s.getAttribute('data-bound') === '1') continue;
      s.setAttribute('data-bound', '1');
      s.addEventListener('input', window.filterLogcat);
      s.addEventListener('keyup', window.filterLogcat);
      bound++;
    }
    var cbs = document.querySelectorAll('.logcat-lvl input');
    for (var j = 0; j < cbs.length; j++) {
      var cb = cbs[j];
      if (cb.getAttribute('data-bound') === '1') continue;
      cb.setAttribute('data-bound', '1');
      cb.addEventListener('change', window.filterLogcat);
      bound++;
    }
  };
}
