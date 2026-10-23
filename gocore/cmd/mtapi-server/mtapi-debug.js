(function(global){
  'use strict';
  var CONFIG = { container: null, maxBuffer: 500, persistErrors: true, skipDebugUrl: true };
  function pad(n,w){ return String(n).padStart(w,'0'); }
  function fmtTime(ms){ var d=new Date(ms); return pad(d.getHours(),2)+':'+pad(d.getMinutes(),2)+':'+pad(d.getSeconds(),2)+'.'+pad(d.getMilliseconds(),3); }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  global._jslogBuf = global._jslogBuf || [];
  function persistError(e){ if(!CONFIG.persistErrors||!global.localStorage) return; try{ var a=JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]'); a.unshift({t:e.t,lvl:e.lvl,m:e.m}); if(a.length>50) a.length=50; global.localStorage.setItem('mtapi-errors',JSON.stringify(a)); }catch(x){} }
  function push(level,args){
    try{
      var msg = Array.prototype.map.call(args,function(a){ if(a instanceof Error || (a && a.stack && a.message)) return a.stack||(a.name+': '+a.message); if(typeof a==='object'){try{return JSON.stringify(a);}catch(e){return String(a);}} return String(a); }).join(' ');
      var entry = { t: Date.now(), lvl: level, m: msg };
      global._jslogBuf.push(entry);
      if(global._jslogBuf.length > CONFIG.maxBuffer) global._jslogBuf.shift();
      var pre = global.document && global.document.getElementById('mtapi-debug-jslog');
      if(pre){
        var lv = level || 'log';
        var cls = 'mtapi-dbg-line lvl-'+(lv==='error'?'e':lv==='warn'?'w':lv==='info'?'i':lv==='debug'?'d':'v');
        var text = fmtTime(entry.t)+' ['+lv+'] '+msg;
        var sp = global.document.createElement('span'); sp.className=cls; sp.style.display='block';
        sp.setAttribute('data-orig',text); sp.textContent=text;
        pre.insertBefore(sp,pre.firstChild);
        if(pre.scrollTop<50) pre.scrollTop=0;
        var cnt = global.document.getElementById('mtapi-debug-jslog-count');
        if(cnt) cnt.textContent = '('+global._jslogBuf.length+')';
      }
      if(level==='error') {
        persistError(entry);
        try {
          var _pre2 = global.document.getElementById('mtapi-debug-errors');
          if (_pre2) {
            var _errs = JSON.parse(global.localStorage.getItem('mtapi-errors') || '[]');
            _pre2.textContent = _errs.map(function(x){ return fmtTime(x.t)+' ['+x.lvl+'] '+x.m; }).join('\\n');
          }
        } catch(e) {}
      }
    }catch(x){}
  }
  var _origCon = {};
  ['log','warn','error','info','debug'].forEach(function(k){ _origCon[k]=global.console[k]; global.console[k]=function(){ push(k,arguments); try{_origCon[k].apply(global.console,arguments);}catch(x){} }; });
  if(global.addEventListener){
    global.addEventListener('error',function(ev){ var st=ev.error&&ev.error.stack?'\n'+ev.error.stack:''; push('error',['Uncaught: '+(ev.message||'?')+' at '+(ev.filename||'?')+':'+(ev.lineno||0)+':'+(ev.colno||0)+st]); });
    global.addEventListener('unhandledrejection',function(ev){ var r=ev.reason; var st=r&&r.stack?'\n'+r.stack:''; push('error',['UnhandledRejection: '+(r&&r.message||r)+st]); });
  }
  var _f = global.fetch;
  if(typeof _f==='function'){
    global.fetch = function(url,opts){
      var t0 = (global.performance&&global.performance.now)?global.performance.now():Date.now();
      var m = (opts&&opts.method?String(opts.method):'GET').toUpperCase();
      var u = String(url);
      var skip = CONFIG.skipDebugUrl && /\/debug(\?|$)|\/devtools\/json/.test(u);
      if(!skip) global.console.log('[net] \u2192 '+m+' '+u);
      return _f(url,opts).then(function(r){
        var ms = Math.round(((global.performance&&global.performance.now)?global.performance.now():Date.now())-t0);
        if(!skip){ var cl=(r.headers&&r.headers.get)?(r.headers.get('content-length')||'?'):'?'; var ct=(r.headers&&r.headers.get)?((r.headers.get('content-type')||'?').split(';')[0]):'?'; global.console.log('[net] \u2190 '+r.status+' '+m+' '+u+' ('+ms+'ms, '+cl+'b, '+ct+')'); }
        return r;
      }).catch(function(e){ var ms=Math.round(((global.performance&&global.performance.now)?global.performance.now():Date.now())-t0); if(!skip) global.console.log('[net] \u2717 '+m+' '+u+' ('+ms+'ms) '+(e&&e.message||e)); throw e; });
    };
  }
  global._perf = global._perf || {};
  global._perfReset = function(){ global._perf = {}; global._mtapiCustomPerf = {}; if (global._perfRefresh) global._perfRefresh(); };
  global._evalConsole = function(){
    var inp = global.document.querySelector('.mtapi-dbg-eval-input'); if(!inp) return;
    var cmd = (inp.value||'').trim(); if(!cmd) return;
    var out;
    try{
      var _evalFn = global['eval']; // MTAPI_EVAL_ALLOW
      var r = _evalFn(cmd);
      out = (r===undefined)?'undefined':(r===null)?'null':(typeof r==='object')?JSON.stringify(r,null,2):String(r);
    }catch(e){ out='Error: '+e.message+(e.stack?'\n'+e.stack:''); push('error',[cmd+' \u2192 '+out]); }
    var pre = global.document.getElementById('mtapi-debug-eval-out'); if(pre) pre.textContent=out;
  };
  
  // MTAPI_LOGCAT_BRIDGE: Logcat секция (own pid) — только если w2a shell добавил AndroidLogcat
  function renderLogcatSection() {
    if (!global.AndroidLogcat || !global.AndroidLogcat.getLogcat) return '';
    try {
      var log = global.AndroidLogcat.getLogcat(100);
      // MTAPI_LOGCAT_REVERSE: новые сверху
      var _logLines = String(log).split(String.fromCharCode(10));
      var _logRev = _logLines.slice().reverse().join(String.fromCharCode(10));
      return '<details style="margin:4px 0"><summary style="cursor:pointer">Logcat (Android, own pid)</summary>' +
        '<div style="margin:4px 0"><button onclick="window._logcatRefresh()">\u21bb Refresh</button></div>' +
        '<pre id="mtapi-debug-logcat" style="max-height:200px;overflow:auto;background:#000;color:#aaa;padding:4px;margin:0;font-size:10px">' + esc(_logRev) + '</pre></details>';
    } catch(e) { return ''; }
  }
  global._logcatRefresh = function() {
    var pre = global.document.getElementById('mtapi-debug-logcat');
    if (pre && global.AndroidLogcat && global.AndroidLogcat.getLogcat) {
      var _l = String(global.AndroidLogcat.getLogcat(100)).split(String.fromCharCode(10));
      pre.textContent = _l.slice().reverse().join(String.fromCharCode(10));
    }
  };

  // MTAPI_PERF_V3: universal Performance
  function renderPerf() {
    var o = '';
    var p = global._perf || {};
    if (p.render != null) o += 'render()       : ' + p.render + 'ms\n';
    if (p.reloadLogcat != null) o += 'reloadLogcat() : ' + p.reloadLogcat + 'ms\n';
    if (p.loadDebugCard != null) o += 'loadDebugCard(): ' + p.loadDebugCard + 'ms\n';
    if (global.performance && global.performance.timing) {
      var t = global.performance.timing, dr = t.domContentLoadedEventEnd - t.navigationStart;
      if (dr > 0) o += 'domReady       : ' + dr + 'ms\n';
    }
    if (global._mtapiAttachStart != null) o += 'attach()       : ' + Math.round((global.performance.now ? global.performance.now() : Date.now()) - global._mtapiAttachStart) + 'ms\n';
    o += 'jslogCount     : ' + global._jslogBuf.length + '\n';
    if (global._mtapiCustomPerf) Object.keys(global._mtapiCustomPerf).forEach(function(k){ o += k + ' : ' + global._mtapiCustomPerf[k] + 'ms\n'; });
    return o || '(no metrics yet)';
  }
  global._perfRefresh = function() {
    var el = global.document && global.document.getElementById('mtapi-debug-perf');
    if (el) el.textContent = renderPerf();
  };

  function renderCard(){
    var c = CONFIG.container || global.document.body;
    var card = global.document.createElement('details'); card.id='mtapi-debug-card';
    card.style.cssText='border:1px solid #444;border-radius:4px;margin:8px 0;background:#1a1a1a;color:#ddd;font-family:monospace;font-size:11px';
    var p1='',p3='';
    for(var i=global._jslogBuf.length-1;i>=0;i--){ var e=global._jslogBuf[i]; p1 += esc(fmtTime(e.t)+' ['+(e.lvl||'log')+'] '+e.m)+'\n'; }
    try{ var er=JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]'); p3=er.map(function(x){return fmtTime(x.t)+' ['+x.lvl+'] '+x.m;}).join('\n'); }catch(x){}
    card.innerHTML =
      '<summary style="cursor:pointer;padding:6px;background:#222;border-bottom:1px solid #444">mtapi-debug v0.1.0</summary>'+
      '<div style="padding:6px">'+
      '<details style="margin:4px 0"><summary style="cursor:pointer">JS Logs <span id="mtapi-debug-jslog-count">('+global._jslogBuf.length+')</span></summary>'+
      '<div style="margin:4px 0"><button onclick="window._jslogBuf=[];document.getElementById(\'mtapi-debug-jslog\').innerHTML=\'\';document.getElementById(\'mtapi-debug-jslog-count\').textContent=\'(0)\'">Clear</button></div>'+
      '<pre id="mtapi-debug-jslog" style="max-height:200px;overflow:auto;background:#000;color:#0f0;padding:4px;margin:0;white-space:pre-wrap">'+p1+'</pre></details>'+
      '<details style="margin:4px 0"><summary style="cursor:pointer">Console Eval</summary>'+
      '<div style="margin:4px 0"><input class="mtapi-dbg-eval-input" placeholder="JS..." style="width:65%;padding:2px;background:#000;color:#ddd;border:1px solid #444"> <button onclick="window._evalConsole()">\u25B6 Run</button></div>'+
      '<pre id="mtapi-debug-eval-out" style="max-height:150px;overflow:auto;background:#000;padding:4px;margin:0">\u2014</pre></details>'+
      '<details style="margin:4px 0"><summary style="cursor:pointer">Performance</summary>'+
      '<div style="margin:4px 0"><button onclick="window._perfReset()">\uD83D\uDD04 Reset</button></div>'+
      '<pre id="mtapi-debug-perf" style="max-height:100px;overflow:auto;background:#000;padding:4px;margin:0">' + renderPerf() + '</pre></details>'+
      '<details style="margin:4px 0"><summary style="cursor:pointer">Errors (persistent)</summary>'+
      '<div style="margin:4px 0"><button onclick="localStorage.removeItem(\'mtapi-errors\');document.getElementById(\'mtapi-debug-errors\').textContent=\'\'">Clear</button></div>'+
      '<pre id="mtapi-debug-errors" style="max-height:150px;overflow:auto;background:#000;color:#f00;padding:4px;margin:0">'+esc(p3)+'</pre></details>'+
      renderLogcatSection()+
      '</div>';
    c.appendChild(card); return card;
  }
  global.MtapiDebug = {
    attach: function(o){ o=o||{}; for(var k in o) if(Object.prototype.hasOwnProperty.call(o,k)) CONFIG[k]=o[k]; return renderCard(); },
    log: function(lvl){ push(lvl, Array.prototype.slice.call(arguments,1)); },
    perf: function(label, ms){ if(!global._mtapiCustomPerf) global._mtapiCustomPerf={}; global._mtapiCustomPerf[label]=Math.round(ms*100)/100; if(global._perfRefresh) global._perfRefresh(); return label+': '+ms+'ms'; },
    time: function(label){ if(!global._mtapiTimers) global._mtapiTimers={}; global._mtapiTimers[label]=(global.performance&&global.performance.now)?global.performance.now():Date.now(); return 'started: '+label; },
    timeEnd: function(label){ if(!global._mtapiTimers||global._mtapiTimers[label]==null) return 'no timer: '+label; var ms=((global.performance&&global.performance.now)?global.performance.now():Date.now())-global._mtapiTimers[label]; delete global._mtapiTimers[label]; return global.MtapiDebug.perf(label,ms); },
    buffer: function(){ return global._jslogBuf.slice(); },
    errors: function(){ try{return JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]');}catch(e){return [];} },
    version: '0.1.0'
  };
})(typeof window !== 'undefined' ? window : globalThis);

// MTAPI_PERSIST_ERR_CLEAR: clear persistent errors from localStorage.
// Was only in app.js; moved here so mtapi-debug.js is self-contained
// and unit tests can call it directly.
if (typeof window !== 'undefined') {
  window._persistErrorsClear = function() {
    try { window.localStorage.removeItem('mtapi-errors'); } catch(e) {}
    try {
      var pre = window.document.getElementById('mtapi-debug-errors');
      if (pre) pre.textContent = '';
    } catch(e) {}
  };
}
