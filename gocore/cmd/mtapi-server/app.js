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
const TOKEN = "{{TOKEN}}";

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
    "/contacts?limit=5", "/calllog?limit=5", "/sms?limit=5"
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
  "/contacts?limit=5","/calllog?limit=5","/sms?limit=5",
  "/calendar?days=7","/app/list"
]);

// ─── renderers ────────────────────────────────────────
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
// ─── MTAPI_DEEP_TABLES_77: deep recursive renderer ────
// object → 30/70 kv table
// nested object → recurses with depth indent
// array of scalars → inline chips
// array of objects (flat) → multi-col table with scalar cells
// array of objects (nested inside) → multi-col table + expandable sub-cell
// array of arrays → multi-col table

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

// Render any nested value as inline HTML (used INSIDE table cells)
function renderCell(v, depth){
  if(_isScalar(v)) return '<span class="'+classifyValue(v)+'">'+esc(cellStr(v))+'</span>';
  if(depth > 5) return '<code style="font-size:9px">'+esc(JSON.stringify(v).slice(0,100))+'</code>';

  if(Array.isArray(v)){
    if(v.length === 0) return '<span class="empty">[]</span>';
    if(_isScalar(v[0])){
      // scalar array: [1, 2, 3] → chips (не сворачиваем — 1 строка)
      return '<span style="font-size:10px">' +
        v.map(function(x){return '<code>'+esc(cellStr(x))+'</code>';}).join(' ') +
        '</span>';
    }
    // array of arrays / objects → <details class="sub">
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
    // array of objects → mini table
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
    // nested object → <details class="sub">
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

  // 1. Scalar table (30/70) — открыта всегда
  if(scalars.length){
    h += '<table class="kv"><tbody>';
    scalars.forEach(function(it){
      h += '<tr><th>'+esc(it.k)+'</th>'+_scalarCell(it.v)+'</tr>';
    });
    h += '</tbody></table>';
  }

  // 2. Nested items — <details class="sub"> (свёрнуты по умолчанию)
  nested.forEach(function(it){
    var k = it.k, v = it.v;
    var count = (Array.isArray(v)) ? v.length : Object.keys(v).length;
    var label = '▸ '+esc(k)+' ('+count+')';

    if(Array.isArray(v)){
      if(v.length === 0){
        h += '<details class="sub"><summary>'+label+'</summary>'+
             '<span class="empty">[]</span></details>';
      } else if(_isScalar(v[0])){
        // scalar array → chips (открыто, не сворачиваем — 1 строка)
        h += '<details class="sub" open><summary>'+label+'</summary>'+
             '<div style="padding:4px 0 4px 12px">' + renderCell(v, depth+1) + '</div></details>';
      } else if(Array.isArray(v[0])){
        // array of arrays
        h += '<details class="sub"><summary>'+label+'</summary>'+
             '<div style="padding-left:12px">' + renderCell(v, depth+1) + '</div></details>';
      } else {
        // array of objects — table, each cell rendered recursively
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
      // nested object → <details class="sub">
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

    // top-level scalar array
    if(_isScalar(data[0])) return '<div style="padding:4px 0">'+renderCell(data, 0)+'</div>';

    // top-level array of arrays
    if(Array.isArray(data[0])) return renderCell(data, 0);

    // top-level array of objects
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
var MAX_INFLIGHT = 3;    // WebView pool is 6; leave 3 for stats + extras
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
  var t0=performance.now();
  var ms=SLOW.has(path)?15000:10000;
  var ctl=new AbortController();
  var timer=setTimeout(function(){ctl.abort()},ms);
  return fetch(url,{signal:ctl.signal}).then(function(r){return r.json()}).then(function(j){
    clearTimeout(timer);
    return {ms: Math.round(performance.now()-t0), json: j};
  }).catch(function(e){
    clearTimeout(timer);
    return {ms: Math.round(performance.now()-t0), error: String(e)};
  });
}

function call(path){
  return new Promise(function(resolve){
    var task = function(){
      _inflight++;
      callDirect(path).then(function(res){
        _inflight--;
        resolve(res);
        _pumpQueue();
      });
    };
    if (_inflight < MAX_INFLIGHT) task();
    else _queue.push(task);
  });
}

function makeCard(path){
  var ep=document.createElement('details');
  ep.className='ep'; ep.dataset.path=path;
  var head=document.createElement('summary'); head.className='ep-h';
  var btn=document.createElement('button'); btn.className='run'; btn.textContent='GET '+path;
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

function render(){
  var q=document.getElementById('q').value.toLowerCase();
  var main=document.getElementById('main'); main.innerHTML='';
  for(var gi=0;gi<ENDPOINTS.length;gi++){
    var g=ENDPOINTS[gi];
    var filtered=g.eps.filter(function(p){return p.toLowerCase().indexOf(q)>=0});
    if(filtered.length===0)continue;
    var gd=document.createElement('details');
    gd.className='group'; gd.dataset.group=g.group; gd.open=false;
    var h=document.createElement('summary'); h.className='group-h';
    h.textContent=g.group+' ('+filtered.length+')';
    gd.appendChild(h);
    for(var pi=0;pi<filtered.length;pi++)gd.appendChild(makeCard(filtered[pi]));
    main.appendChild(gd);
  }
}

// ─── updateStats ─────────────────────────────────────
var _statsBusy=false;
function updateStats(){
  // MTAPI_SEMAPHORE_78: direct calls (bypass queue) so header is always fast
  callDirect('/battery').then(function(r){
    if(r.json&&r.json.data){
      var b=r.json.data;
      var pct=b.percentage||0;
      var cls=pct>60?'pct-hi':pct>20?'pct-md':'pct-lo';
      document.getElementById('st-batt').innerHTML=
        'battery <b>'+pct+'%</b>'+(b.charging?' ⚡':'')+
        '<span class="bar"><i class="'+cls+'" style="width:'+pct+'%"></i></span>';
    } else {
      document.getElementById('st-batt').innerHTML='battery <b style="color:var(--err)">?</b>';
    }
  });
  callDirect('/system').then(function(r){
    if(r.json&&r.json.data&&r.json.data.ram){
      var rm=r.json.data.ram;
      var used=rm.totalBytes-rm.availableBytes;
      var pct=Math.round(used/rm.totalBytes*100);
      var cls=pct>85?'pct-lo':pct>70?'pct-md':'pct-hi';
      document.getElementById('st-ram').innerHTML=
        'ram <b>'+pct+'%</b><span class="bar"><i class="'+cls+'" style="width:'+pct+'%"></i></span>';
    } else {
      document.getElementById('st-ram').innerHTML='ram <b style="color:var(--err)">?</b>';
    }
  });
  callDirect('/ping').then(function(r){
    if(r.error){
      document.getElementById('st-ping').innerHTML='ping <b style="color:var(--err)">err</b>';
    } else {
      document.getElementById('st-ping').innerHTML='ping <b>'+r.ms+'ms</b>'+
        (r.json&&r.json.ok?' <span style="color:var(--ok)">●</span>':' <span style="color:var(--err)">●</span>');
    }
  });
}

// ─── live toggle ─────────────────────────────────────
var liveOn=false, liveTimer=null;
function setLive(on){
  liveOn=on;
  document.getElementById('live').classList.toggle('on',on);
  if(liveTimer){clearInterval(liveTimer);liveTimer=null}
  if(on)liveTimer=setInterval(updateStats,5000);
}

// ─── theme ───────────────────────────────────────────
var savedTheme=localStorage.getItem('mtapi-theme');
// MTAPI_108: тёмная по умолчанию (если нет savedTheme — dark, игнорируем system)
if (typeof document !== 'undefined') {
document.documentElement.setAttribute('data-theme', savedTheme || 'dark');
function updateThemeBtn(){
  var cur=document.documentElement.getAttribute('data-theme') || 'dark';
  document.getElementById('theme').textContent=cur==='light'?'\u2600\uFE0F':'\uD83C\uDF19';
}
document.getElementById('theme').addEventListener('click',function(){
  var cur=document.documentElement.getAttribute('data-theme') || 'dark';
  var next=cur==='light'?'dark':'light';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('mtapi-theme',next);
  updateThemeBtn();
});

// copy
if (typeof document !== 'undefined') {
document.getElementById('copy').addEventListener('click',function(){
  navigator.clipboard.writeText(TOKEN).then(function(){
    var b=document.getElementById('copy');b.textContent='copied';
    setTimeout(function(){b.textContent='copy'},1500);
  }).catch(function(){});
});

// search
document.getElementById('q').addEventListener('input',render);

// reset
document.getElementById('reset').addEventListener('click',function(){
  _queue = [];
  _inflight = 0;
  document.getElementById('st-batt').innerHTML='battery —';
  document.getElementById('st-ram').innerHTML='ram —';
  document.getElementById('st-ping').innerHTML='ping —';
  document.querySelectorAll('.ep').forEach(function(ep){
    var st=ep.querySelector('.status');
    if(st){st.className='status';st.textContent='';}
    ep.querySelector('.ep-b').hidden=true;
  });
  updateStats();
});

// live toggle
document.getElementById('live').addEventListener('click',function(){setLive(!liveOn)});

// init
render();

} // MTAPI_143


// MTAPI_145

updateThemeBtn();
updateStats();
setLive(false);
} // MTAPI_150


// kill any old SW
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(regs){
    regs.forEach(function(r){ r.unregister(); });
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

// ─── MTAPI_140: exports для тестов (node) ───
if (typeof module !== 'undefined' && module.exports) {
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
    isStatic: typeof isStatic === 'function' ? isStatic : null
  };
}
