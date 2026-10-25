(function(global){
  'use strict';

  var CONFIG = {
    container: null,
    maxBuffer: 500,
    persistErrors: true,
    skipDebugUrl: true,
    showFab: true,
  };

  // ─── utilities ─────────────────────────────────────────────
  function pad(n,w){ return String(n).padStart(w,'0'); }
  function fmtTime(ms){ var d=new Date(ms); return pad(d.getHours(),2)+':'+pad(d.getMinutes(),2)+':'+pad(d.getSeconds(),2)+'.'+pad(d.getMilliseconds(),3); }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  // ─── buffers ───────────────────────────────────────────────
  global._jslogBuf = global._jslogBuf || [];
  global._netBuf = global._netBuf || [];
  if (global._netVerbose === undefined) global._netVerbose = true;

  function persistError(e){
    if(!CONFIG.persistErrors||!global.localStorage) return;
    try{ var a=JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]'); a.unshift({t:e.t,lvl:e.lvl,m:e.m}); if(a.length>50) a.length=50; global.localStorage.setItem('mtapi-errors',JSON.stringify(a)); }catch(x){}
  }

  // ─── console interceptor ──────────────────────────────────
  function push(level,args){
    try{
      var msg = Array.prototype.map.call(args,function(a){
        if(a instanceof Error || (a && a.stack && a.message)) return a.stack||(a.name+': '+a.message);
        if(typeof a==='object'){try{return JSON.stringify(a);}catch(e){return String(a);}}
        return String(a);
      }).join(' ');
      var entry = { t: Date.now(), lvl: level, m: msg };
      global._jslogBuf.push(entry);
      if(global._jslogBuf.length > CONFIG.maxBuffer) global._jslogBuf.shift();
      var pre = global.document && global.document.getElementById('mtapi-debug-jslog');
      if(pre){
        var lv = level || 'log';
        var text = fmtTime(entry.t)+' ['+lv+'] '+msg;
        var sp = global.document.createElement('span'); sp.style.display='block';
        sp.setAttribute('data-orig',text); sp.textContent=text;
        pre.insertBefore(sp,pre.firstChild);
        if(pre.scrollTop<50) pre.scrollTop=0;
      }
      var cnt = global.document && global.document.getElementById('mtapi-debug-jslog-count');
      if(cnt) cnt.textContent = '('+global._jslogBuf.length+')';
      if(level==='error'){
        persistError(entry);
        try{
          var _pre2 = global.document.getElementById('mtapi-debug-errors');
          if (_pre2) {
            var _errs = JSON.parse(global.localStorage.getItem('mtapi-errors') || '[]');
            _pre2.textContent = _errs.map(function(x){ return fmtTime(x.t)+' ['+x.lvl+'] '+x.m; }).join('\n');
          }
        }catch(e){}
      }
    }catch(x){}
  }

  var _origCon = {};
  ['log','warn','error','info','debug'].forEach(function(k){
    _origCon[k]=global.console[k];
    global.console[k]=function(){ push(k,arguments); try{_origCon[k].apply(global.console,arguments);}catch(x){} };
  });
  if(global.addEventListener){
    global.addEventListener('error',function(ev){ var st=ev.error&&ev.error.stack?'\n'+ev.error.stack:''; push('error',['Uncaught: '+(ev.message||'?')+' at '+(ev.filename||'?')+':'+(ev.lineno||0)+':'+(ev.colno||0)+st]); });
    global.addEventListener('unhandledrejection',function(ev){ var r=ev.reason; var st=r&&r.stack?'\n'+r.stack:''; push('error',['UnhandledRejection: '+(r&&r.message||r)+st]); });
  }

  // ─── fetch interceptor + network buffer ───────────────────
  function _netPush(entry){
    global._netBuf.push(entry);
    if (global._netBuf.length > 100) global._netBuf.shift();
    var cnt = global.document && global.document.getElementById('mtapi-debug-net-count');
    if (cnt) cnt.textContent = '(' + global._netBuf.length + ')';
    if (global._netRefresh) { try { global._netRefresh(); } catch(x) {} }
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
        var cl=(r.headers&&r.headers.get)?(r.headers.get('content-length')||'?'):'?';
        var ct=(r.headers&&r.headers.get)?((r.headers.get('content-type')||'?').split(';')[0]):'?';
        if(!skip){
          global.console.log('[net] \u2190 '+r.status+' '+m+' '+u+' ('+ms+'ms, '+cl+'b, '+ct+')');
          var entry = { t: Date.now(), method: m, url: u, status: r.status, ms: ms, size: cl, ct: ct, body: null };
          try { r.clone().text().then(function(b){ entry.body = b.length > 2048 ? b.slice(0, 2048) + '\n... (' + (b.length - 2048) + ' more)' : b; _netPush(entry); }).catch(function(){ _netPush(entry); }); }
          catch(e) { _netPush(entry); }
        }
        return r;
      }).catch(function(e){ var ms=Math.round(((global.performance&&global.performance.now)?global.performance.now():Date.now())-t0); if(!skip) global.console.log('[net] \u2717 '+m+' '+u+' ('+ms+'ms) '+(e&&e.message||e)); throw e; });
    };
  }

  // ─── perf ─────────────────────────────────────────────────
  global._perf = global._perf || {};
  global._perfReset = function(){ global._perf = {}; global._mtapiCustomPerf = {}; if (global._perfRefresh) global._perfRefresh(); };
  function renderPerf(){
    var rows = [];
    var p = global._perf || {};
    if (p.render != null) rows.push({k: 'render()', v: p.render + 'ms'});
    if (p.reloadLogcat != null) rows.push({k: 'reloadLogcat()', v: p.reloadLogcat + 'ms'});
    if (p.loadDebugCard != null) rows.push({k: 'loadDebugCard()', v: p.loadDebugCard + 'ms'});
    if (global.performance && global.performance.timing) {
      var t = global.performance.timing, dr = t.domContentLoadedEventEnd - t.navigationStart;
      if (dr > 0) rows.push({k: 'domReady', v: dr + 'ms'});
    }
    if (global._mtapiAttachStart != null) {
      rows.push({k: 'attach()', v: Math.round((global.performance.now ? global.performance.now() : Date.now()) - global._mtapiAttachStart) + 'ms'});
    }
    rows.push({k: 'jslogCount', v: String(global._jslogBuf.length)});
    if (global._mtapiCustomPerf) {
      Object.keys(global._mtapiCustomPerf).forEach(function(k){ rows.push({k: k, v: global._mtapiCustomPerf[k] + 'ms'}); });
    }
    if (!rows.length) return '<table class="mtapi-debug-table"><tbody><tr><td colspan="2" style="color:#666">(no metrics yet)</td></tr></tbody></table>';
    var html = '<table class="mtapi-debug-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
    rows.forEach(function(r){
      html += '<tr><td style="color:#888">' + esc(r.k) + '</td><td style="color:#ddd">' + esc(r.v) + '</td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  global._perfRefresh = function(){ var el = global.document && global.document.getElementById('mtapi-debug-perf'); if (el) el.innerHTML = renderPerf(); };

  // ─── eval console ─────────────────────────────────────────
  function _renderEvalOutput(r) {
    if (r === undefined) return '<pre style="margin:0;background:transparent;color:#888">undefined</pre>';
    if (r === null) return '<pre style="margin:0;background:transparent;color:#888">null</pre>';
    if (typeof r === 'string') return '<pre style="margin:0;white-space:pre-wrap;background:transparent;color:#ddd">' + esc(r) + '</pre>';
    if (typeof r === 'object') {
      if (typeof global.renderData === 'function') {
        try { return global.renderData(r); } catch(e){}
      }
      try { return '<pre style="margin:0;white-space:pre-wrap;background:transparent;color:#ddd">' + esc(JSON.stringify(r,null,2)) + '</pre>'; } catch(e){}
    }
    return '<pre style="margin:0;background:transparent;color:#ddd">' + esc(String(r)) + '</pre>';
  }
  global._evalCopy = function() {
    var el = global.document && global.document.getElementById('mtapi-debug-eval-out');
    if (!el) return;
    var text = el.textContent || '';
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function() {
        if (global._mtapiToast) global._mtapiToast('Copied eval output (' + text.length + ' chars)');
      }).catch(function() {
        if (typeof _copyFallback === 'function') _copyFallback(text);
        if (global._mtapiToast) global._mtapiToast('Copied (fallback)');
      });
    } else if (typeof _copyFallback === 'function') {
      _copyFallback(text);
      if (global._mtapiToast) global._mtapiToast('Copied (fallback)');
    }
  };

  global._evalClear = function(){
    var out = global.document && global.document.getElementById('mtapi-debug-eval-out');
    if (out) out.innerHTML = '\u2014';
    var inp = global.document && global.document.querySelector('.mtapi-dbg-eval-input');
    if (inp) inp.value = '';
  };

  global._evalHelp = function() {
    var help = [
      '=== Console — quick start (?) ===',
      '',
      'Copy any line, run (Ctrl+Enter).',
      '',
      '--- Fetch endpoint ---',
      'fetch("/battery").then(r => r.json()).then(j => log(j))',
      'fetch("/sensors").then(r => r.json()).then(j => log(j))',
      'fetch("/system").then(r => r.json()).then(j => log(j))',
      '',
      '--- DOM ---',
      '$("#main")',
      '$$("details").length',
      '',
      '--- Inspect (highlight + info) ---',
      'inspect($("#main"))',
      '',
      '--- Logs ---',
      'log("test", 123, {a: 1})',
      '',
      '--- Debug tabs ---',
      'MtapiDebug.setTab("logs")',
      'MtapiDebug.setTab("network")',
      '',
      '--- More help ---',
      '??   cheatsheet (all commands)',
      '???  full (examples + navigation)',
      '',
      '=== End ===',
    ].join('\n');
    var out = global.document.getElementById('mtapi-debug-eval-out');
    if (out) out.innerHTML = '<pre style="margin:0;white-space:pre-wrap;color:#aaa;font-size:10px">' + esc(help) + '</pre>';
  };
  global.$ = function(sel){ return global.document.querySelector(sel); };
  global.$$ = function(sel){ return Array.prototype.slice.call(global.document.querySelectorAll(sel)); };
  global.help = global._evalHelp;
  global.domShowFloating = function(){ if (typeof global._domShowFloating === "function") global._domShowFloating(); };
  global.domRefresh = function(){ if (typeof global._domRefresh === "function") global._domRefresh(); };
  global.clearEval = global._evalClear;
  global.domInspect = function(){ if (typeof global._domInspect === 'function') global._domInspect(); };
  global.domInspectStop = function(){ if (typeof global._domInspectStop === 'function') global._domInspectStop(); };

  global._evalToggleMd = function() {
    var md = global.document.querySelector('.mtapi-dbg-eval-input-md');
    var inp = global.document.querySelector('.mtapi-dbg-eval-input');
    var btn = global.document.getElementById('mtapi-debug-eval-md-btn');
    if (!md) return;
    var show = md.style.display === 'none';
    md.style.display = show ? 'block' : 'none';
    if (inp) inp.style.display = show ? 'none' : 'block';
    if (btn) btn.style.background = show ? 'var(--accent,#4fc3f7)' : '';
    if (show) { try { md.value = inp ? inp.value : ''; md.focus(); } catch(e){} }
    else { try { if (inp) inp.value = md.value; } catch(e){} }
  };

  global._evalNavExamples = function() {
    var ex = [
      '=== mtapi — full (???) — copy & run ===',
      '',
      'All examples are working. Copy any line, Ctrl+Enter.',
      '',
      '--- API endpoints: Basic (16) ---',
      'fetch("/ping").then(r => r.json()).then(j => log(j))',
      'fetch("/battery").then(r => r.json()).then(j => log(j))',
      'fetch("/wifi").then(r => r.json()).then(j => log(j))',
      'fetch("/device").then(r => r.json()).then(j => log(j))',
      'fetch("/location").then(r => r.json()).then(j => log(j))',
      'fetch("/clipboard").then(r => r.json()).then(j => log(j))',
      'fetch("/clipboard?op=set&text=hello").then(r => r.json()).then(j => log(j))',
      'fetch("/toast?text=hello").then(r => r.json()).then(j => log(j))',
      'fetch("/notify?title=Hi&body=There").then(r => r.json()).then(j => log(j))',
      'fetch("/vibrate?ms=200").then(r => r.json()).then(j => log(j))',
      'fetch("/torch?on=1").then(r => r.json()).then(j => log(j))',
      'fetch("/torch?on=0").then(r => r.json()).then(j => log(j))',
      'fetch("/torch/brightness?level=50").then(r => r.json()).then(j => log(j))',
      'fetch("/torch/brightness?level=0").then(r => r.json()).then(j => log(j))',
      'fetch("/tts?text=hello").then(r => r.json()).then(j => log(j))',
      'fetch("/share?title=Hi&text=There").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Contacts / SMS (3) ---',
      'fetch("/contacts?limit=0").then(r => r.json()).then(j => log(j))',
      'fetch("/calllog?limit=0").then(r => r.json()).then(j => log(j))',
      'fetch("/sms?limit=0").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: System (6) ---',
      'fetch("/system").then(r => r.json()).then(j => log(j))',
      'fetch("/cpu/detail").then(r => r.json()).then(j => log(j))',
      'fetch("/thermal").then(r => r.json()).then(j => log(j))',
      'fetch("/memory").then(r => r.json()).then(j => log(j))',
      'fetch("/storage").then(r => r.json()).then(j => log(j))',
      'fetch("/kernel").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Network (8) ---',
      'fetch("/network").then(r => r.json()).then(j => log(j))',
      'fetch("/wifi/detailed").then(r => r.json()).then(j => log(j))',
      'fetch("/bluetooth").then(r => r.json()).then(j => log(j))',
      'fetch("/telephony").then(r => r.json()).then(j => log(j))',
      'fetch("/wifi/scan").then(r => r.json()).then(j => log(j))',
      'fetch("/net/ping?host=8.8.8.8&count=3").then(r => r.json()).then(j => log(j))',
      'fetch("/net/dns?host=example.com").then(r => r.json()).then(j => log(j))',
      'fetch("/net/fetch?url=https%3A%2F%2Fapi.ipify.org%3Fformat%3Djson").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Display / Audio (7) ---',
      'fetch("/display").then(r => r.json()).then(j => log(j))',
      'fetch("/display/brightness").then(r => r.json()).then(j => log(j))',
      'fetch("/display/color").then(r => r.json()).then(j => log(j))',
      'fetch("/audio").then(r => r.json()).then(j => log(j))',
      'fetch("/microphone").then(r => r.json()).then(j => log(j))',
      'fetch("/audio/volume?stream=2").then(r => r.json()).then(j => log(j))',
      'fetch("/audio/ringer").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Sensors (4) ---',
      'fetch("/sensors").then(r => r.json()).then(j => log(j))',
      'fetch("/sensors/read?name=accelerometer&ms=200").then(r => r.json()).then(j => log(j))',
      'fetch("/sensors/stream?name=accelerometer&hz=10").then(r => r.json()).then(j => log(j))',
      'fetch("/sensors/stream/stop?name=accelerometer").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Hardware (4) ---',
      'fetch("/features").then(r => r.json()).then(j => log(j))',
      'fetch("/camera/list").then(r => r.json()).then(j => log(j))',
      'fetch("/camera/snapshot").then(r => r.json()).then(j => log(j))',
      'fetch("/microphone/record?seconds=3").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Apps (2) ---',
      'fetch("/app/list").then(r => r.json()).then(j => log(j))',
      'fetch("/app/launch?pkg=com.android.settings").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Detailed (5) ---',
      'fetch("/battery/detailed").then(r => r.json()).then(j => log(j))',
      'fetch("/location/detailed").then(r => r.json()).then(j => log(j))',
      'fetch("/locale").then(r => r.json()).then(j => log(j))',
      'fetch("/calendar?days=7").then(r => r.json()).then(j => log(j))',
      'fetch("/alarm/next").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Files / Audio play (5) ---',
      'fetch("/files/save?name=test.txt&data=hello").then(r => r.json()).then(j => log(j))',
      'fetch("/audio/play?uri=/system/media/audio/notifications/Hello.ogg").then(r => r.json()).then(j => log(j))',
      'fetch("/audio/play/stop").then(r => r.json()).then(j => log(j))',
      'fetch("/tts/voices").then(r => r.json()).then(j => log(j))',
      'fetch("/tts/stop").then(r => r.json()).then(j => log(j))',
      '',
      '--- API: Watch (logcat) (4) ---',
      'fetch("/clipboard/watch?hz=2").then(r => r.json()).then(j => log(j))',
      'fetch("/clipboard/watch/stop").then(r => r.json()).then(j => log(j))',
      'fetch("/location/watch?hz=1").then(r => r.json()).then(j => log(j))',
      'fetch("/location/watch/stop").then(r => r.json()).then(j => log(j))',
      '',
      '--- Debug tabs ---',
      'MtapiDebug.open()',
      'MtapiDebug.setTab("logs")',
      'MtapiDebug.setTab("console")',
      'MtapiDebug.setTab("errors")',
      'MtapiDebug.setTab("logcat")',
      'MtapiDebug.setTab("devtools")',
      'MtapiDebug.setTab("system")',
      'MtapiDebug.setTab("network")',
      'MtapiDebug.close()',
      '',
      '--- DOM floating ---',
      'domShowFloating()',
      'domInspect()',
      'domInspectStop()',
      '_domRefresh()',
      '_domToggleRoot()',
      '',
      '--- Browser ---',
      '_browserOpen()',
      '_browserOpen("https://html.duckduckgo.com/html/")',
      '_browserNavigate("https://example.com")',
      '_browserClose()',
      '',
      '--- Native (APK) ---',
      'Android.getLogcat(20)',
      'Android.processList()',
      'Android.getDeviceInfo()',
      '',
      '--- AI Snap (advanced) ---',
      'inspect($("#main"))',
      '_aiSnap()',
      '_aiSnapWithRequest("make it red")',
      '_aiSnapWithRequest("convert to flexbox")',
      '_captureElement()',
      '',
      '--- Events ---',
      'document.dispatchEvent(new CustomEvent("mtapi-debug-inspect"))',
      'document.dispatchEvent(new CustomEvent("mtapi-debug-select", {detail:{selector:"#main"}}))',
      'document.dispatchEvent(new CustomEvent("mtapi-debug-select", {detail:{element:document.body}}))',
      '',
      '--- Help levels ---',
      '?    quick (5-7 commands)',
      '??   cheatsheet (all commands)',
      '???  full (this — examples + navigation)',
      '',
      '=== End (copy & run) ===',
    ].join('\n');
    var out = global.document.getElementById('mtapi-debug-eval-out');
    if (out) out.innerHTML = '<pre style="margin:0;white-space:pre-wrap;color:#aaa;font-size:10px">' + esc(ex) + '</pre>';
  };

  global._evalConsole = async function(){
    var inp = global.document.querySelector('.mtapi-dbg-eval-input');
    if (!inp) return;
    var cmd = (inp.value||'').trim(); if(!cmd) return;
    if (cmd === '???' || cmd === 'examples()' || cmd === 'nav()') { if (global._evalNavExamples) global._evalNavExamples(); if (inp) inp.value = ''; return; }
    var out;
    try{ var _evalFn = global['eval']; var _wrapped = /(^|[^a-zA-Z0-9_$.])await(\s|$)/.test(cmd) ? '(async () => { return (' + cmd + '); })()' : cmd; var r = _evalFn(_wrapped); if (r && typeof r.then === 'function') { r = await r; } out = _renderEvalOutput(r); }
    catch(e){ out='<pre style="margin:0;color:#f66;background:transparent">Error: '+esc(e.message)+'</pre>'; push('error',[cmd+' \u2192 '+e.message]); }
    var pre = global.document.getElementById('mtapi-debug-eval-out'); if(pre) pre.innerHTML=out;
  };

  // ─── logcat ───────────────────────────────────────────────
  function _getLogcatFromBridge() {
    var raw = null;
    if (global.AndroidLogcat && global.AndroidLogcat.getLogcat) {
      try { raw = String(global.AndroidLogcat.getLogcat(100)); }
      catch(e) { raw = '(AndroidLogcat error: ' + e.message + ')'; }
    }
    if ((raw == null || raw === '') && global.Android && global.Android.getLogcat) {
      try { raw = String(global.Android.getLogcat(100)); }
      catch(e) { raw = '(Android.getLogcat error: ' + e.message + ')'; }
    }
    if (raw == null) return '(logcat bridge not available — neither AndroidLogcat nor Android.getLogcat)';
    if (raw === '' || raw === 'undefined' || raw === 'null') {
      return '(logcat empty — Android 11+ restricts logcat for untrusted apps without root. Try `adb logcat` from PC, or check "system info" tab.)';
    }
    return raw;
  }
  function detectLogLevel(line) {
    var m = line.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+\d+\s+([VDIWEF])\s/);
    if (m) return m[1];
    if (/\bFATAL\b/.test(line)) return 'F';
    if (/\bERROR\b/.test(line)) return 'E';
    if (/\bWARN\b/.test(line)) return 'W';
    if (/\bDEBUG\b/.test(line)) return 'D';
    if (/\bINFO\b/.test(line)) return 'I';
    return 'V';
  }
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
  function _copyFallback(text) {
    try {
      var ta = global.document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      global.document.body.appendChild(ta);
      ta.select();
      global.document.execCommand('copy');
      global.document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  }
  function _iconBtn(icon, label, onclick, cls) {
    var c = 'icon-btn-sm' + (cls ? ' ' + cls : '');
    return '<button class="' + c + '" aria-label="' + label + '" title="' + label + '" onclick="' + onclick + '">' + icon + '</button>';
  }
  function _iconSearch(id, oninput) {
    return '<input id="' + id + '" class="proc-search" placeholder="search..." oninput="' + oninput + '">';
  }

  global._copyText = function(text) {
    if (!text) { try { global.console.log('[copy] empty'); } catch(x){} return; }
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function(){
        try { global.console.log('[copy] ok (' + text.length + 'b)'); } catch(x){}
      }).catch(function(){ _copyFallback(text); });
    } else {
      _copyFallback(text);
      try { global.console.log('[copy] fallback (' + text.length + 'b)'); } catch(x){}
    }
  };
  global._copyById = function(id) {
    var el = global.document.getElementById(id);
    if (!el) return;
    global._copyText(el.textContent || '');
  };
  global._copyLogcat = function() {
    var el = global.document.getElementById('mtapi-debug-logcat');
    if (!el) return;
    global._copyText(el.textContent || '');
  };
  global._copyJslog = function() {
    var el = global.document.getElementById('mtapi-debug-jslog');
    if (!el) return;
    global._copyText(el.textContent || '');
  };
  global._copyErrors = function() {
    var el = global.document.getElementById('mtapi-debug-errors');
    if (!el) return;
    global._copyText(el.textContent || '');
  };
  global._copyNetwork = function() {
    var el = global.document.getElementById('mtapi-debug-network');
    if (!el) return;
    global._copyText(el.textContent || '');
  };
  global._jslogClear = function() {
    global._jslogBuf = [];
    if (global.document) {
      var pre = global.document.getElementById('mtapi-debug-jslog');
      if (pre) pre.innerHTML = '';
      var cnt = global.document.getElementById('mtapi-debug-jslog-count');
      if (cnt) cnt.textContent = '(0)';
    }
  };
  global._errorsClear = function() {
    try { global.localStorage.removeItem('mtapi-errors'); } catch(e) {}
    var pre = global.document.getElementById('mtapi-debug-errors');
    if (pre) pre.textContent = '';
  };
  global._netClear = function() {
    global._netBuf = [];
    if (global._netRefresh) global._netRefresh();
  };

  function _parseLogcatLine(line) {
    // "MM-DD HH:MM:SS.mmm  PID  TID L TAG: message"
    var m = line.match(/^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s?(.*)$/);
    if (m) return { date: m[1], time: m[2], pid: m[3], tid: m[4], lvl: m[5], tag: m[6], msg: m[7] };
    return null;
  }
  function _renderLogcatWithQuery(q) {
    var log = _getLogcatFromBridge();
    if (log == null) return '<table class="mtapi-debug-table"><tbody><tr><td colspan="6" style="color:#666">(loading...)</td></tr></tbody></table>';
    var lines = log.split('\n').slice().reverse();
    var out = '';
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      var lvl = detectLogLevel(lines[i]).toLowerCase();
      var p = _parseLogcatLine(lines[i]);
      if (p) {
        var msgHtml = q ? _highlightString(p.msg, q) : esc(p.msg);
        var tagHtml = q ? _highlightString(p.tag, q) : esc(p.tag);
        out += '<tr data-lvl="' + lvl + '">'
          + '<td style="white-space:nowrap;color:#666;font-size:9px">' + esc(p.time) + '</td>'
          + '<td style="color:#555;font-size:9px;text-align:right">' + esc(p.pid) + '</td>'
          + '<td style="color:#555;font-size:9px;text-align:right">' + esc(p.tid) + '</td>'
          + '<td class="lvl-ind lvl-' + lvl + '">' + p.lvl + '</td>'
          + '<td style="color:#4fc3f7;font-size:10px">' + tagHtml + '</td>'
          + '<td class="logcat-line lvl-' + lvl + '">' + msgHtml + '</td>'
          + '</tr>';
      } else {
        var raw = q ? _highlightString(lines[i], q) : esc(lines[i]);
        out += '<tr data-lvl="' + lvl + '">'
          + '<td style="color:#666;font-size:9px">-</td>'
          + '<td></td><td></td>'
          + '<td class="lvl-ind lvl-' + lvl + '">' + lvl.toUpperCase() + '</td>'
          + '<td></td>'
          + '<td class="logcat-line lvl-' + lvl + '">' + raw + '</td>'
          + '</tr>';
      }
    }
    if (!out) return '<table class="mtapi-debug-table"><tbody><tr><td colspan="6" style="color:#666">(empty)</td></tr></tbody></table>';
    return '<table class="mtapi-debug-table"><thead><tr>'
      + '<th style="width:80px">Time</th>'
      + '<th style="width:50px">PID</th>'
      + '<th style="width:50px">TID</th>'
      + '<th style="width:20px">L</th>'
      + '<th style="width:90px">Tag</th>'
      + '<th>Message</th>'
      + '</tr></thead><tbody>' + out + '</tbody></table>';
  }
  function _renderJslogWithQuery(q) {
    var out = '';
    for (var i = global._jslogBuf.length - 1; i >= 0; i--) {
      var e = global._jslogBuf[i];
      // Filter out timer-driven /debug and /devtools/json noise
      if (/\[net\].*(\/debug|\/devtools\/json)/.test(e.m || '')) continue;
      var lvl = (e.lvl || 'log').toLowerCase();
      var sLvl = (lvl === 'error' ? 'e' : lvl === 'warn' ? 'w' : lvl === 'info' ? 'i' : lvl === 'debug' ? 'd' : 'v');
      var msgHtml = q ? _highlightString(e.m, q) : esc(e.m);
      out += '<tr data-lvl="' + sLvl + '"><td style="white-space:nowrap;color:#666">' + fmtTime(e.t) + '</td><td class="lvl-ind lvl-' + sLvl + '">' + sLvl.toUpperCase() + '</td><td class="logcat-line lvl-' + sLvl + '">' + msgHtml + '</td></tr>';
    }
    if (!out) return '<table class="mtapi-debug-table"><tbody><tr><td colspan="3" style="color:#666">(empty)</td></tr></tbody></table>';
    return '<table class="mtapi-debug-table"><thead><tr><th style="width:90px">Time</th><th style="width:20px">L</th><th>Message</th></tr></thead><tbody>' + out + '</tbody></table>';
  }
  global._refreshLogcatQuery = function() {
    var inp = global.document.getElementById('mtapi-debug-logcat-search');
    var pre = global.document.getElementById('mtapi-debug-logcat');
    if (!pre) return;
    pre.innerHTML = _renderLogcatWithQuery(inp ? inp.value : '');
  };
  var _jslogLiveInterval = null;
  global._jslogLiveStart = function(ms) {
    if (_jslogLiveInterval) clearInterval(_jslogLiveInterval);
    ms = ms || 2000;
    _jslogLiveInterval = setInterval(function() {
      if (global._refreshJslogQuery) { try { global._refreshJslogQuery(); } catch(e){} }
    }, ms);
  };
  global._jslogLiveStop = function() {
    if (_jslogLiveInterval) { clearInterval(_jslogLiveInterval); _jslogLiveInterval = null; }
  };

  global._refreshJslogQuery = function() {
    var inp = global.document.getElementById('mtapi-debug-jslog-search');
    var pre = global.document.getElementById('mtapi-debug-jslog');
    if (!pre) return;
    pre.innerHTML = _renderJslogWithQuery(inp ? inp.value : '');
    var cnt = global.document.getElementById('mtapi-debug-jslog-count');
    if (cnt) cnt.textContent = '(' + global._jslogBuf.length + ')';
    // Re-apply level filters (V/D/I/W/E/F checkboxes) after re-render
    if (global._jslogFilter) { try { global._jslogFilter(); } catch(e){} }
  };

  function _renderErrorsWithQuery(q) {
    var er = [];
    try { er = JSON.parse(global.localStorage.getItem('mtapi-errors') || '[]'); } catch(e) {}
    var out = '';
    for (var i = 0; i < er.length; i++) {
      var msgHtml = q ? _highlightString(er[i].m, q) : esc(er[i].m);
      out += '<tr data-lvl="e"><td style="white-space:nowrap;color:#666">' + fmtTime(er[i].t) + '</td><td class="lvl-ind lvl-e">E</td><td class="logcat-line lvl-e">' + msgHtml + '</td></tr>';
    }
    if (!out) return '<table class="mtapi-debug-table"><tbody><tr><td colspan="3" style="color:#666">(empty)</td></tr></tbody></table>';
    return '<table class="mtapi-debug-table"><thead><tr><th style="width:90px">Time</th><th style="width:20px">L</th><th>Message</th></tr></thead><tbody>' + out + '</tbody></table>';
  }
  global._refreshErrorsQuery = function() {
    var inp = global.document.getElementById('mtapi-debug-errors-search');
    var pre = global.document.getElementById('mtapi-debug-errors');
    if (!pre) return;
    pre.innerHTML = _renderErrorsWithQuery(inp ? inp.value : '');
  };

  function renderLogcat(){ return _renderLogcatWithQuery(''); }
  global._jslogFilter = function() {
    var pre = global.document.getElementById('mtapi-debug-jslog');
    if (!pre) return;
    var checks = global.document.querySelectorAll('#mtapi-debug-jslog-lvl input[data-lvl]');
    var show = {};
    Array.prototype.forEach.call(checks, function(c){ show[c.getAttribute('data-lvl')] = c.checked; });
    Array.prototype.forEach.call(pre.querySelectorAll('tbody tr[data-lvl]'), function(tr){
      var lvl = tr.getAttribute('data-lvl');
      tr.style.display = show[lvl] ? '' : 'none';
    });
  };
  global._logcatFilter = function() {
    var pre = global.document.getElementById('mtapi-debug-logcat');
    if (!pre) return;
    var checks = global.document.querySelectorAll('.logcat-lvl input[data-lvl]');
    var show = {};
    Array.prototype.forEach.call(checks, function(c){ show[c.getAttribute('data-lvl')] = c.checked; });
    Array.prototype.forEach.call(pre.querySelectorAll('tbody tr[data-lvl]'), function(tr){
      var lvl = tr.getAttribute('data-lvl');
      tr.style.display = show[lvl] ? '' : 'none';
    });
  };
  var _logcatLiveInterval = null;
  global._logcatLiveStart = function(ms) {
    if (_logcatLiveInterval) clearInterval(_logcatLiveInterval);
    ms = ms || 3000;
    _logcatLiveInterval = setInterval(function() {
      // Only refresh if Logcat tab is active (perf)
      if (_activeTab === 'logcat' && global._logcatRefresh) {
        try { global._logcatRefresh(); } catch(e){}
      }
    }, ms);
  };
  global._logcatLiveStop = function() {
    if (_logcatLiveInterval) { clearInterval(_logcatLiveInterval); _logcatLiveInterval = null; }
  };

  global._logcatClear = function() {
    var ok = false;
    if (global.Android && global.Android.clearLogcat) {
      try { String(global.Android.clearLogcat()); ok = true; } catch(e) {}
    }
    var el = global.document.getElementById('mtapi-debug-logcat');
    if (el) el.innerHTML = '<span style="color:#666">(cleared — next refresh shows new lines only)</span>';
    setTimeout(function() { if (global._logcatRefresh) { try { global._logcatRefresh(); } catch(e){} } }, 300);
  };

  global._logcatRefresh = function(){
    var pre = global.document.getElementById('mtapi-debug-logcat'); if (!pre) return;
    pre.textContent = '(loading...)';
    var log = _getLogcatFromBridge();
    if (log != null) {
      pre.innerHTML = _renderLogcatWithQuery('');
      // Re-apply level filter (Logcat) after re-render
      if (global._logcatFilter) { try { global._logcatFilter(); } catch(e){} }
      return;
    }
    var token = ''; try { var m = global.location.search.match(/[?&]token=([^&]+)/); if (m) token = m[1]; } catch(e) {}
    var url = '/debug' + (token ? '?token=' + encodeURIComponent(token) : '');
    var f = global.fetch; if (!f) { pre.textContent = '(no fetch)'; return; }
    f(url).then(function(r){ return r.json(); }).then(function(j){
      var data = (j && j.data) ? j.data : j;
      var lc = (data.logcat || '');
      var ls=String(lc).split('\n').slice().reverse();var o='';for(var i=0;i<ls.length;i++){if(!ls[i])continue;var l=detectLogLevel(ls[i]).toLowerCase();o+='<span class="logcat-line lvl-'+l+'">'+esc(ls[i])+'</span>';}pre.innerHTML=o||'<span style="color:#666">(empty)</span>';
    }).catch(function(e){ pre.textContent = '(logcat unavailable: ' + e.message + ')'; });
  };

  // ─── network table ────────────────────────────────────────
  function renderNetwork(){
    var buf = global._netBuf || [];
    var inp = global.document && global.document.getElementById('mtapi-debug-network-search');
    var q = inp ? (inp.value || '').toLowerCase() : '';
    if (q) { buf = buf.filter(function(e){ return (e.url + ' ' + e.method + ' ' + e.status).toLowerCase().indexOf(q) !== -1; }); }
    if (!buf.length) return '<div style="color:#666;padding:4px">(no requests' + (q ? ' matching "' + esc(q) + '"' : ' captured') + ')</div>';
    var o = '<table style="width:100%;border-collapse:collapse;font-size:10px">';
    o += '<thead><tr style="background:#222"><th>Time</th><th>Method</th><th>URL</th><th>Status</th><th>Size</th><th>CT</th><th>ms</th></tr></thead><tbody>';
    for (var i = buf.length - 1; i >= 0; i--) {
      var e = buf[i];
      o += '<tr style="border-top:1px solid #333"><td>' + esc(fmtTime(e.t)) + '</td><td>' + esc(e.method) + '</td><td title="' + esc(e.url) + '">' + esc(e.url.length > 60 ? e.url.slice(0, 60) + '...' : e.url) + '</td><td>' + esc(String(e.status)) + '</td><td>' + esc(String(e.size)) + '</td><td>' + esc(String(e.ct)) + '</td><td>' + esc(String(e.ms)) + '</td></tr>';
      if (e.body) {
        var bodyHtml = '';
        var parsed = null, isJson = false;
        try { parsed = JSON.parse(e.body); isJson = true; } catch(x){}
        if (isJson && parsed !== null && typeof parsed === 'object' && typeof window.renderData === 'function') {
          try {
            bodyHtml = '<div class="net-body-json">' + window.renderData(parsed) + '</div>';
          } catch(y) {
            bodyHtml = '<pre class="net-body-pre">' + esc(e.body) + '</pre>';
          }
        } else {
          bodyHtml = '<pre class="net-body-pre">' + esc(e.body) + '</pre>';
        }
        o += '<tr><td colspan="7" class="net-body-cell">' + bodyHtml + '</td></tr>';
      }
    }
    return o + '</tbody></table>';
  }
  global._netRefresh = function(){ var el = global.document && global.document.getElementById('mtapi-debug-network'); if (el) el.innerHTML = renderNetwork(); };

  // ─── DOM tree ─────────────────────────────────────────────
  function getCssSelector(el){
    if (!el || el.nodeType !== 1) return '';
    var path = [];
    while (el && el.nodeType === 1) {
      var seg = (el.tagName || '?').toLowerCase();
      if (el.id) { seg += '#' + el.id; path.unshift(seg); break; }
      var parent = el.parentNode;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children || [], function(c){ return c.tagName === el.tagName; });
        if (siblings.length > 1) { var idx = Array.prototype.indexOf.call(siblings, el) + 1; seg += ':nth-of-type(' + idx + ')'; }
      }
      path.unshift(seg);
      el = el.parentNode;
      if (path.length > 8) break;
    }
    return path.join(' > ');
  }
  function inspectElement(el){
    if (!el) return;
    if (!global._domInspectActive) return;  // guard: no highlight if inspect OFF
    global._lastInspected = el;
    var aiBtn = global.document.getElementById('mtapi-debug-ai-snap-btn');
    if (aiBtn) { try { aiBtn.disabled = !(global._domInspectActive || global._domInspectActive === true); } catch(e){} }
    try {
      var selBox = global.document.getElementById('mtapi-debug-select-box');
      if (!selBox) {
        selBox = global.document.createElement('div');
        selBox.id = 'mtapi-debug-select-box';
        selBox.style.cssText = 'position:fixed;pointer-events:none;z-index:10000002;border:2px solid #f0f;background:rgba(240,0,240,0.2);display:none;border-radius:2px;transition:opacity 0.3s';
        global.document.body.appendChild(selBox);
      }
      var r = el.getBoundingClientRect();
      selBox.style.left = r.left + 'px';
      selBox.style.top = r.top + 'px';
      selBox.style.width = r.width + 'px';
      selBox.style.height = r.height + 'px';
      selBox.style.display = 'block';
      selBox.style.opacity = '1';
      clearTimeout(selBox.__timer);
      selBox.__timer = setTimeout(function() { try { selBox.style.opacity = '0'; setTimeout(function(){ selBox.style.display = 'none'; }, 300); } catch(e){} }, 1500);
    } catch(x) {}
    var info = global.document.getElementById('mtapi-debug-dom-info'); if (!info) return;
    var parts = [];
    var sel = '?';
    try { sel = (typeof getCssSelector === 'function') ? getCssSelector(el) : (el.tagName || '?').toLowerCase(); } catch(e) { sel = (el.tagName || '?').toLowerCase(); }
    parts.push('<b>Selector:</b> ' + esc(sel));
    parts.push('<b>Tag:</b> ' + esc(el.tagName || '?'));
    if (el.id) parts.push('<b>ID:</b> ' + esc(el.id));
    if (el.className && typeof el.className === 'string') parts.push('<b>Classes:</b> ' + esc(el.className));
    parts.push('<b>Attributes:</b>');
    if (el.attributes && el.attributes.length) { for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; parts.push('&nbsp;&nbsp;' + esc(a.name) + '=&quot;' + esc(a.value) + '&quot;'); } }
    else parts.push('&nbsp;&nbsp;(none)');
    try {
      var cs = global.getComputedStyle ? global.getComputedStyle(el) : null;
      if (cs) { parts.push('<b>Computed:</b>'); ['display','position','width','height','color','background-color','font-size'].forEach(function(k){ try { parts.push('&nbsp;&nbsp;' + k + ': ' + esc(cs.getPropertyValue(k))); } catch(x){} }); }
    } catch(x) {}
    var outer = el.outerHTML || '';
    parts.push('<b>OuterHTML (truncated):</b>');
    parts.push('<pre style="max-height:150px;overflow:auto;background:#000;color:#aaa;padding:2px;margin:0;font-size:9px;white-space:pre-wrap">' + esc(outer.length > 2000 ? outer.slice(0, 2000) + '\n...' : outer) + '</pre>');
    info.innerHTML = parts.join('<br>');
  
    // ── NEW: highlight in DOM tree + print selector in Console ──
    try {
      var tree = global.document.getElementById('mtapi-debug-dom-tree');
      if (tree) {
        var elTag = (el.tagName || '').toLowerCase();
        var all = tree.querySelectorAll('[data-tag="' + elTag + '"]');
        var match = null;
        for (var ti = 0; ti < all.length; ti++) {
          var txt = (all[ti].textContent || '');
          if (el.id && txt.indexOf('#' + el.id) >= 0) { match = all[ti]; break; }
          if (el.className && typeof el.className === 'string') {
            var cls = el.className.split(/\s+/)[0];
            if (cls && txt.indexOf('.' + cls) >= 0) { match = all[ti]; break; }
          }
        }
        if (!match && all.length) match = all[0];
        if (match) {
          try { match.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch(e) {}
          var prevBg = match.style.background;
          var prevColor = match.style.color;
          match.style.background = '#f0f';
          match.style.color = '#000';
          match.style.transition = 'background 0.3s';
          setTimeout(function() {
            try { match.style.background = prevBg; match.style.color = prevColor; } catch(e) {}
          }, 2000);
        }
      }
    } catch(e) { try { console.warn('[select tree]', e); } catch(x){} }
    try {
      var out = global.document.getElementById('mtapi-debug-eval-out');
      if (out) {
        var sel = '?';
        try { sel = (typeof getCssSelector === 'function') ? getCssSelector(el) : (el.tagName || '?').toLowerCase(); } catch(e) { sel = (el.tagName || '?').toLowerCase(); }
        var banner = '<div style="padding:6px 8px;margin:0 0 6px;background:#1a1a1a;border-left:3px solid #f0f;font-family:monospace;font-size:11px;color:#ddd">'
          + '<div style="color:#f0f;font-weight:bold;margin-bottom:2px">\u25A3 Selected</div>'
          + '<div><b>selector:</b> <code style="background:#222;padding:1px 3px;color:#4fc3f7">' + esc(sel) + '</code></div>'
          + '<div style="margin-top:4px"><b>copy to re-select:</b></div>'
          + '<div><code style="display:block;background:#000;color:#0f0;padding:3px 6px;margin-top:2px;user-select:all">MtapiDebug.selectElement("' + esc(sel) + '")</code></div>'
          + '</div>';
        out.innerHTML = banner + out.innerHTML;
      }
    } catch(e) { try { console.warn('[select console]', e); } catch(x){} }
}
  function buildDomTree(root, depth) {
    if (!root || depth > 25) return null;
    var doc = global.document;
    var ul = doc.createElement('ul');
    ul.style.cssText = 'list-style:none;padding-left:12px;margin:0;font-family:monospace;font-size:11px';
    var children = root.children || [];
    for (var i = 0; i < children.length; i++) {
      var el = children[i]; if (!el.tagName) continue;
      var li = doc.createElement('li');
      var det = doc.createElement('details'); det.open = depth < 2;
      var sum = doc.createElement('summary'); sum.style.cssText = 'cursor:pointer;padding:1px 2px;user-select:none';
      var tag = (el.tagName || '').toLowerCase();
      var idPart = el.id ? '#' + el.id : '';
      var clsPart = (el.className && typeof el.className === 'string') ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      sum.textContent = tag + idPart + clsPart;
      sum.setAttribute('data-tag', tag);
      (function(elem, s){ s.addEventListener('click', function(ev){ if (ev.target === s) { if (global._domInspectActive) { try { inspectElement(elem); } catch(e){} ev.preventDefault(); ev.stopPropagation(); } } }); })(el, sum);
      det.appendChild(sum);
      if (el.children && el.children.length > 0) { var childUl = buildDomTree(el, depth + 1); if (childUl) det.appendChild(childUl); }
      li.appendChild(det); ul.appendChild(li);
    }
    return ul;
  }
  global._domCloseFloating = function() {
    var all = global.document.querySelectorAll('[id^="mtapi-debug-dom-floating"]');
    for (var i = 0; i < all.length; i++) {
      try { all[i].remove(); } catch(e){}
    }
  };

  global._domShowFloating = function() {
    if (global._domCloseFloating) global._domCloseFloating();

    var vw = global.innerWidth || 400;
    var vh = global.innerHeight || 600;
    var ww = Math.round(vw * 1.3);
    var wh = Math.min(520, vh - 60);
    var wl = 10;

    var w = global.document.createElement('div');
    w.id = 'mtapi-debug-dom-floating';
    w.style.cssText = 'position:fixed;top:60px;left:' + wl + 'px;width:' + ww + 'px;height:' + wh + 'px;min-width:280px;min-height:160px;max-height:none;background:var(--bg2,#0d0d0d);border:2px solid var(--accent,#4fc3f7);border-radius:6px;z-index:10000000;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.7);overflow:hidden';

    var header = global.document.createElement('div');
    header.id = 'mtapi-debug-dom-floating-header';
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3,#222);border-bottom:1px solid var(--bg4,#444);flex-shrink:0;cursor:move;user-select:none;gap:4px';
    header.innerHTML = '<b style="color:var(--accent,#4fc3f7);font-family:monospace;white-space:nowrap">\uD83C\uDF33 DOM</b>'
      + '<div style="display:flex;gap:3px;flex-wrap:nowrap">'
      + '<button class="icon-btn-sm accent" onclick="event.stopPropagation();window._domRefresh&&window._domRefresh()" title="Refresh">\u21bb</button>'
      + '<button class="icon-btn-sm" id="mtapi-debug-inspect-btn" onclick="event.stopPropagation();window._domInspect&&window._domInspect()" title="Select element (toggle)">\u25A3</button>'
            + '<button class="icon-btn-sm" onclick="event.stopPropagation();window._captureElement&&window._captureElement()" title="Copy HTML of selected element">\uD83D\uDCCB</button>'
      + '<button class="icon-btn-sm accent" id="mtapi-debug-ai-snap-btn" onclick="event.stopPropagation();window._aiSnap&&window._aiSnap()" title="AI Snap (select element first)" disabled>\u2728</button>'
      
      
      + '<button class="icon-btn-sm danger" onclick="event.stopPropagation();window._domCloseFloating&&window._domCloseFloating()" title="Close">\u2715</button>'
      + '</div>';
    w.appendChild(header);

    var body = global.document.createElement('div');
    body.id = 'mtapi-debug-dom-floating-body';
    body.style.cssText = 'flex:1 1 0;display:flex;flex-direction:row;align-items:stretch;gap:0;overflow:hidden;min-height:0;min-width:0;height:100%';
    body.innerHTML = '<div id="mtapi-debug-dom-tree" style="flex:1 1 0;min-width:80px;min-height:40px;max-width:none;max-height:none;overflow:auto;background:#000;padding:4px;font-family:monospace;font-size:11px;resize:both">(loading...)</div>'
      + '<div id="mtapi-debug-dom-splitter" title="Drag to resize (double-click to reset)" style="flex:0 0 14px;height:100%;cursor:col-resize;background:var(--bg4,#444);user-select:none;display:flex;align-items:center;justify-content:center;color:var(--fg3,#888);font-size:14px;line-height:1;letter-spacing:-2px">\u22ee\u22ee</div>'
      + '<div id="mtapi-debug-dom-info" style="flex:0 0 220px;min-width:80px;min-height:40px;max-width:none;max-height:none;overflow-y:scroll;overflow-x:auto;background:#0d0d0d;padding:4px;font-size:10px;resize:both">(tap element)</div>';
    w.appendChild(body);

    // 8 edge/corner resize handles (with visible grip icon)
    // ── edge resize state + handlers (8 directions) ──
    var er = {active: false, dir: '', startX: 0, startY: 0, startW: 0, startH: 0, startL: 0, startT: 0};
    function _edgeStart(e, dir) {
      er.active = true; er.dir = dir;
      var c = _dgc(e); er.startX = c.x; er.startY = c.y;
      var r = w.getBoundingClientRect();
      er.startW = r.width; er.startH = r.height; er.startL = r.left; er.startT = r.top;
      global.document.addEventListener('mousemove', _edgeMove);
      global.document.addEventListener('mouseup', _edgeEnd);
      global.document.addEventListener('touchmove', _edgeMove, {passive: false});
      global.document.addEventListener('touchend', _edgeEnd);
      e.preventDefault(); e.stopPropagation();
    }
    function _edgeMove(e) {
      if (!er.active) return;
      var c = _dgc(e); var dx = c.x - er.startX, dy = c.y - er.startY;
      var d = er.dir;
      var nw = er.startW, nh = er.startH, nl = er.startL, nt = er.startT;
      if (d.indexOf('e') !== -1) nw = Math.max(200, er.startW + dx);
      if (d.indexOf('s') !== -1) nh = Math.max(120, er.startH + dy);
      if (d.indexOf('w') !== -1) { nw = Math.max(200, er.startW - dx); nl = er.startL + (er.startW - nw); }
      if (d.indexOf('n') !== -1) { nh = Math.max(120, er.startH - dy); nt = er.startT + (er.startH - nh); }
      w.style.width = nw + 'px';
      w.style.height = nh + 'px';
      w.style.left = nl + 'px';
      w.style.top = nt + 'px';
      if (e.cancelable) e.preventDefault();
    }
    function _edgeEnd() {
      er.active = false;
      global.document.removeEventListener('mousemove', _edgeMove);
      global.document.removeEventListener('mouseup', _edgeEnd);
      global.document.removeEventListener('touchmove', _edgeMove);
      global.document.removeEventListener('touchend', _edgeEnd);
    }

    var edges = [
      {id: 'n',  css: 'top:0;left:20px;right:20px;height:8px;cursor:ns-resize',  dir: 'n'},
      {id: 's',  css: 'bottom:0;left:20px;right:20px;height:8px;cursor:ns-resize', dir: 's'},
      {id: 'w',  css: 'left:0;top:20px;bottom:20px;width:8px;cursor:ew-resize',   dir: 'w'},
      {id: 'e',  css: 'right:0;top:20px;bottom:20px;width:8px;cursor:ew-resize',  dir: 'e'},
      {id: 'nw', css: 'left:0;top:0;width:16px;height:16px;cursor:nwse-resize',    dir: 'nw'},
      {id: 'ne', css: 'right:0;top:0;width:16px;height:16px;cursor:nesw-resize',   dir: 'ne'},
      {id: 'sw', css: 'left:0;bottom:0;width:16px;height:16px;cursor:nesw-resize', dir: 'sw'},
      {id: 'se', css: 'right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize',dir: 'se'}
    ];
    edges.forEach(function(e) {
      var h = global.document.createElement('div');
      h.className = 'mtapi-debug-resize-edge';
      h.setAttribute('data-dir', e.dir);
      var grip = (e.dir === 'se' || e.dir === 'nw' || e.dir === 'ne' || e.dir === 'sw') ? '\u25E2' : '';
      h.style.cssText = 'position:absolute;z-index:2;' + e.css + ';background:transparent';
      if (grip) h.textContent = grip;
      h.style.color = 'var(--accent,#4fc3f7)';
      h.style.fontSize = '12px';
      h.style.lineHeight = '12px';
      h.style.textAlign = (e.dir === 'se') ? 'right' : (e.dir === 'nw' || e.dir === 'sw') ? 'left' : 'center';
      h.addEventListener('mousedown', function(ev) { _edgeStart(ev, e.dir); });
      h.addEventListener('touchstart', function(ev) { _edgeStart(ev, e.dir); }, {passive: false});
      w.appendChild(h);
    });

    global.document.body.appendChild(w);

    var drag = {active: false, startX: 0, startY: 0, left: 0, top: 0};
    function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function _dgc(e) { var t = (e.touches && e.touches[0]) ? e.touches[0] : e; return {x: t.clientX, y: t.clientY}; }
    function _dInt(el) { if (!el) return false; return el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || (el.closest && el.closest('button, input, select, textarea')); }
    function _dStart(e) {
      var t = e.target || (e.touches && e.touches[0] && e.touches[0].target);
      if (_dInt(t)) return;
      drag.active = true;
      var c = _dgc(e); drag.startX = c.x; drag.startY = c.y;
      var r = w.getBoundingClientRect();
      drag.left = r.left; drag.top = r.top;
      w.style.right = 'auto';
      w.style.left = drag.left + 'px';
      w.style.top = drag.top + 'px';
      global.document.addEventListener('mousemove', _dMove);
      global.document.addEventListener('mouseup', _dEnd);
      global.document.addEventListener('touchmove', _dMove, {passive: false});
      global.document.addEventListener('touchend', _dEnd);
      e.preventDefault();
    }
    function _dMove(e) {
      if (!drag.active) return;
      var c = _dgc(e); var dx = c.x - drag.startX, dy = c.y - drag.startY;
      var minL = -w.offsetWidth + 60, maxL = global.innerWidth - 60;
      var minT = -w.offsetHeight + 60, maxT = global.innerHeight - 60;
      w.style.left = _clamp(drag.left + dx, minL, maxL) + 'px';
      w.style.top = _clamp(drag.top + dy, minT, maxT) + 'px';
      if (e.cancelable) e.preventDefault();
    }
    function _dEnd() {
      drag.active = false;
      global.document.removeEventListener('mousemove', _dMove);
      global.document.removeEventListener('mouseup', _dEnd);
      global.document.removeEventListener('touchmove', _dMove);
      global.document.removeEventListener('touchend', _dEnd);
    }
    header.addEventListener('mousedown', _dStart);
    header.addEventListener('touchstart', _dStart, {passive: false});

    // (old _rz* removed; using _edge*)


    var split = {active: false};
    var splitter = global.document.getElementById('mtapi-debug-dom-splitter');
    var infoPane = global.document.getElementById('mtapi-debug-dom-info');
    if (splitter && infoPane) {
      splitter.addEventListener('dblclick', function() {
        infoPane.style.flex = '0 0 220px';
      });
      splitter.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        split.active = true; e.preventDefault();
        splitter.style.background = 'var(--accent,#4fc3f7)';
        splitter.style.color = '#000';
        global.document.addEventListener('mousemove', _splitMove);
        global.document.addEventListener('mouseup', _splitEnd);
      });
      splitter.addEventListener('touchstart', function(e) {
        split.active = true; e.preventDefault();
        splitter.style.background = 'var(--accent,#4fc3f7)';
        global.document.addEventListener('touchmove', _splitMove, {passive:false});
        global.document.addEventListener('touchend', _splitEnd);
      }, {passive: false});
      function _splitMove(e) {
        if (!split.active) return;
        var c = _dgc(e); var r = body.getBoundingClientRect();
        var fromRight = _clamp(r.right - c.x, 80, r.width - 100);
        infoPane.style.flex = '0 0 ' + fromRight + 'px';
        if (e.cancelable) e.preventDefault();
      }
      function _splitEnd() {
        split.active = false;
        splitter.style.background = 'var(--bg4,#444)';
        splitter.style.color = 'var(--fg3,#888)';
        global.document.removeEventListener('mousemove', _splitMove);
        global.document.removeEventListener('mouseup', _splitEnd);
        global.document.removeEventListener('touchmove', _splitMove);
        global.document.removeEventListener('touchend', _splitEnd);
      }
    }

    var _rt = function() {
      try {
        if (typeof global._domRefresh === 'function') global._domRefresh();
        else if (typeof _domRefresh === 'function') _domRefresh();
      } catch(e) { try { global.console.error('[dom] refresh:', e); } catch(x){} }
    };
    setTimeout(_rt, 50);
    setTimeout(_rt, 300);
  };

  global._domMinimize = function() {
    var w = global.document.getElementById('mtapi-debug-dom-floating');
    if (!w) return;
    var body = global.document.getElementById('mtapi-debug-dom-floating-body');
    if (!body) return;
    var isMin = body.style.display === 'none';
    if (isMin) {
      body.style.display = 'flex';
      w.style.height = w.getAttribute('data-prev-height') || '520px';
      w.style.minHeight = w.getAttribute('data-prev-minheight') || '160px';
    } else {
      w.setAttribute('data-prev-height', w.style.height || '520px');
      w.setAttribute('data-prev-minheight', w.style.minHeight || '160px');
      body.style.display = 'none';
      w.style.height = 'auto';
      w.style.minHeight = '0';
    }
    body.style.flexDirection = 'row';
    body.style.alignItems = 'stretch';
    var btn = w.querySelector('button[title="Minimize"]');
    if (btn) btn.textContent = isMin ? '\u2013' : '+';
  };

  global._mtapiToast = function(msg) {
    try {
      var t = global.document.getElementById('mtapi-debug-toast');
      if (!t) {
        t = global.document.createElement('div');
        t.id = 'mtapi-debug-toast';
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--accent,#4fc3f7);color:#000;padding:8px 16px;border-radius:4px;font-family:monospace;font-size:12px;z-index:10000001;opacity:0;transition:opacity 0.2s;pointer-events:none';
        global.document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t.__timer);
      t.__timer = setTimeout(function() { t.style.opacity = '0'; }, 2000);
    } catch(e) {}
  };

  global._domHide = function() {
    var w = global.document.getElementById('mtapi-debug-dom-floating');
    if (!w) return;
    var hidden = w.style.opacity === '0';
    w.style.opacity = hidden ? '1' : '0';
    w.style.pointerEvents = hidden ? 'auto' : 'none';
    var btn = w.querySelector('button[title="Hide"]');
    if (btn) btn.textContent = hidden ? '\uD83D\uDC41' : '\uD83D\uDC41\u200D\uD83D\uDDE8';
  };

  function _buildAISnapshot(el, userRequest) {
    var cs = global.getComputedStyle ? global.getComputedStyle(el) : null;
    var sel = (typeof getCssSelector === 'function') ? getCssSelector(el) : (el.tagName || '?').toLowerCase();
    var md = '## Element: `' + sel + '`\n\n';
    md += 'Tag: `' + (el.tagName || '?').toLowerCase() + '`\n';
    if (el.id) md += 'ID: `#' + el.id + '`\n';
    if (el.className && typeof el.className === 'string') md += 'Classes: `.' + el.className.split(/\s+/).filter(Boolean).join('.') + '`\n';
    md += '\n### HTML\n```html\n' + ((el.outerHTML || '').slice(0, 3000)) + '\n```\n\n';
    md += '### Computed CSS\n```css\n';
    if (cs) {
      ['display','position','width','height','min-width','min-height','max-width','max-height','padding','margin','border','color','background-color','font-size','font-weight','font-family','line-height','flex','flex-direction','grid','grid-template-columns','gap','overflow','z-index','opacity','transform','transition'].forEach(function(k){
        try { var v = cs.getPropertyValue(k); if (v) md += k + ': ' + v + ';\n'; } catch(e){}
      });
    }
    md += '```\n\n';
    if (el.parentElement) md += '### Parent\n`' + (el.parentElement.tagName || '?').toLowerCase() + (el.parentElement.id ? '#' + el.parentElement.id : '') + '`\n\n';
    if (el.children && el.children.length) {
      md += '### Children (' + el.children.length + ')\n';
      for (var i = 0; i < Math.min(el.children.length, 10); i++) {
        md += '- `' + (el.children[i].tagName || '?').toLowerCase() + '`';
        if (el.children[i].className && typeof el.children[i].className === 'string') md += ' .' + el.children[i].className.split(/\s+/).filter(Boolean).join('.');
        md += '\n';
      }
      md += '\n';
    }
    if (userRequest) {
      md += '### User Request\n' + userRequest + '\n\n### Task\nModify the HTML/CSS above according to the request. Return the complete updated element or CSS changes.\n';
    } else {
      md += '### Task\nExplain this element and suggest improvements. Return CSS-only modifications if possible.\n';
    }
    return md;
  }
  function _copyAiSnap(md) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(md).then(function(){ try { console.log('[aiSnap] copied (' + md.length + ' chars)'); } catch(e){} }).catch(function(){ if (typeof _copyFallback === 'function') _copyFallback(md); });
    } else if (typeof _copyFallback === 'function') {
      _copyFallback(md);
    }
  }
  global._captureElement = function() {
    var el = global._lastInspected;
    if (!el) {
      if (global._mtapiToast) global._mtapiToast('Select element first (🔍 then tap)');
      return;
    }
    var html = el.outerHTML || '';
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(html).then(function() {
        if (global._mtapiToast) global._mtapiToast('Copied HTML (' + html.length + ' chars)');
      }).catch(function() {
        if (typeof _copyFallback === 'function') _copyFallback(html);
        if (global._mtapiToast) global._mtapiToast('Copied HTML (fallback)');
      });
    } else if (typeof _copyFallback === 'function') {
      _copyFallback(html);
      if (global._mtapiToast) global._mtapiToast('Copied HTML (fallback)');
    }
  };

  global._aiSnap = function() {
    var el = global._lastInspected;
    if (!el) { if (global._mtapiToast) global._mtapiToast('Select element first (🔍 then tap)'); return; }
    var md = _buildAISnapshot(el, '');
    _copyAiSnap(md);
    if (global._mtapiToast) global._mtapiToast('Copied AI prompt (' + md.length + ' chars) → paste into DeepSeek/ChatGPT');
  };
  global._aiSnapWithRequest = function(prompt) {
    var el = global._lastInspected;
    if (!el) { try { alert('Select an element first'); } catch(e){} return; }
    var req = prompt || (global.prompt ? global.prompt('Describe the change you want:') : '');
    if (!req) return;
    _copyAiSnap(_buildAISnapshot(el, req));
  };

  global._domRootMode = 'overlay';
  global._domToggleRoot = function() {
    global._domRootMode = (global._domRootMode === 'overlay') ? 'page' : 'overlay';
    var btn = global.document.getElementById('mtapi-debug-root-toggle');
    if (btn) {
      btn.textContent = (global._domRootMode === 'overlay') ? '\u25A3' : '\uD83C\uDF10';
      btn.title = (global._domRootMode === 'overlay') ? 'Root: overlay (tap for page)' : 'Root: page (tap for overlay)';
    }
    if (global._domRefresh) global._domRefresh();
    if (global._mtapiToast) global._mtapiToast('DOM root: ' + global._domRootMode);
  };

  global._domRefresh = function(){
    var container = global.document && global.document.getElementById('mtapi-debug-dom-tree'); if (!container) return;
    container.innerHTML = '';
    var root = (global._domRootMode === 'overlay') ? (global.document.getElementById('mtapi-debug-overlay') || global.document.documentElement) : global.document.documentElement; if (!root) return;
    var doc = global.document;
    var rootDet = doc.createElement('details'); rootDet.open = true;
    var rootSum = doc.createElement('summary');
    var _rootLabel = (global._domRootMode === 'overlay') ? 'overlay' : 'html';
    rootSum.textContent = _rootLabel; rootSum.setAttribute('data-tag', _rootLabel);
    rootSum.style.cssText = 'cursor:pointer;padding:1px 2px;user-select:none';
    (function(elem, s){ s.addEventListener('click', function(ev){ if (ev.target === s) { if (global._domInspectActive) { try { inspectElement(elem); } catch(e){} ev.preventDefault(); ev.stopPropagation(); } } }); })(root, rootSum);
    rootDet.appendChild(rootSum);
    var tree = buildDomTree(root, 0); if (tree) rootDet.appendChild(tree);
    container.appendChild(rootDet);
  };
  var _domInspectActive = false;
  global._domInspectActive = false;
  global._domInspectStop = function() {
    _domInspectActive = false;
    global._domInspectActive = false;
    try { global.document.removeEventListener('click', _domClickHandler, true); } catch(e){}
    try { global.document.removeEventListener('mousemove', _domHoverHandler, true); } catch(e){}
    if (typeof _domEscHandler === 'function') { try { global.document.removeEventListener('keydown', _domEscHandler, true); } catch(e){} }
    if (typeof _domHoverHide === 'function') { try { _domHoverHide(); } catch(e){} }
    var selBtn = global.document.getElementById('mtapi-debug-inspect-btn');
    if (selBtn) { try { selBtn.style.background = ''; selBtn.style.color = ''; selBtn.style.borderColor = ''; } catch(e){} }
    var aiBtn = global.document.getElementById('mtapi-debug-ai-snap-btn');
    if (aiBtn) { try { aiBtn.disabled = true; } catch(e){} }
    var ov = global.document.getElementById('mtapi-debug-overlay');
    if (ov) { try { ov.style.pointerEvents = ''; } catch(e){} }
    var ind = global.document.getElementById('mtapi-debug-dom-inspect-ind');
    if (ind) ind.textContent = '\u25CB off';
  };
function _domClickHandler(ev){
    if (!_domInspectActive) return;
    var t = ev.target;
    if (!t) return;
    // NEVER block <summary> inside DOM tree (or floating) — <details> toggle must work.
    // Also never block any click that would toggle a <details>.
    var tree = global.document.getElementById('mtapi-debug-dom-tree');
    var fl = global.document.getElementById('mtapi-debug-dom-floating');
    if (t.tagName === 'SUMMARY' && ((tree && tree.contains(t)) || (fl && fl.contains(t)))) {
      // Allow the native <details> toggle. Do NOT preventDefault / stopPropagation.
      // Optionally: highlight (but not block).
      return;
    }
    // Block interactive controls (buttons/inputs) — they have their own handlers.
    if (t.closest && t.closest('button, input, select, textarea, .mtapi-debug-fab, #mtapi-debug-dom-floating-header, #mtapi-debug-dom-splitter')) return;
    // Block overlay UI content (except tree/info/floating)
    var ov = global.document.getElementById('mtapi-debug-overlay');
    if (ov && ov.contains(t)) {
      var info = global.document.getElementById('mtapi-debug-dom-info');
      if (tree && tree.contains(t)) { /* allowed */ }
      else if (info && info.contains(t)) { /* allowed */ }
      else if (fl && fl.contains(t)) { /* allowed */ }
      else { return; }
    }
    ev.preventDefault();
    ev.stopPropagation();
    try { inspectElement(t); } catch(e) { try { global.console.error('[inspect]', e); } catch(x){} }
  }
  var _lastHovered = null;
  var _hoverBox = null;
  function _ensureHoverBox() {
    if (_hoverBox) return _hoverBox;
    _hoverBox = global.document.createElement('div');
    _hoverBox.id = 'mtapi-debug-hover-box';
    _hoverBox.style.cssText = 'position:fixed;pointer-events:none;z-index:9999997;border:2px solid #f44;background:rgba(244,68,68,0.08);display:none;border-radius:2px';
    global.document.body.appendChild(_hoverBox);
    return _hoverBox;
  }
  function _isOverlayElement(el) {
    if (!el) return false;
    var cur = el;
    while (cur) {
      if (cur.id === 'mtapi-debug-dom-tree' || cur.id === 'mtapi-debug-dom-info') return false;
      if (cur.classList && (cur.classList.contains('mtapi-debug-overlay') || cur.classList.contains('mtapi-debug-fab'))) return true;
      if (cur.id === 'mtapi-debug-dom-floating-header' || cur.id === 'mtapi-debug-dom-splitter') return true;
      cur = cur.parentElement;
    }
    return false;
  }
  function _domHoverHandler(ev) {
    if (!_domInspectActive) return;
    var el = ev.target;
    if (el === _lastHovered) return;
    if (_isOverlayElement(el)) { if (_hoverBox) _hoverBox.style.display = 'none'; return; }
    _lastHovered = el;
    try {
      var box = _ensureHoverBox();
      var r = el.getBoundingClientRect();
      box.style.display = 'block';
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
    } catch(e) {}
  }
  function _domHoverHide() {
    if (_hoverBox) _hoverBox.style.display = 'none';
    _lastHovered = null;
  }
  global._domInspect = function(){
    _domInspectActive = !_domInspectActive;
    var ind = global.document && global.document.getElementById('mtapi-debug-dom-inspect-ind');
    if (_domInspectActive) {
      global._domInspectActive = true;
      var selBtn = global.document.getElementById('mtapi-debug-inspect-btn');
      if (selBtn) { selBtn.style.background = '#f0f'; selBtn.style.color = '#000'; selBtn.style.borderColor = '#f0f'; }
      var aiBtn = global.document.getElementById('mtapi-debug-ai-snap-btn');
      if (aiBtn) aiBtn.disabled = !global._lastInspected;
      var ov = global.document.getElementById('mtapi-debug-overlay');
      if (ov) {
        ov.style.pointerEvents = 'none';
        // Re-enable pointer-events on interactive children of overlay
        var autoSel = '.mtapi-debug-topbar, .mtapi-debug-tabs, .mtapi-debug-topbar button, .mtapi-debug-tabs button, .mtapi-debug-content, .mtapi-debug-content > [data-tab-content].active, #mtapi-debug-dom-floating, #mtapi-debug-dom-tree, #mtapi-debug-dom-info';
        try {
          var autos = ov.querySelectorAll(autoSel);
          for (var ai = 0; ai < autos.length; ai++) autos[ai].style.pointerEvents = 'auto';
        } catch(e) {}
      }
      var fl = global.document.getElementById('mtapi-debug-dom-floating');
      if (fl) fl.style.pointerEvents = 'auto';
      global.document.addEventListener('click', _domClickHandler, true);
      global.document.addEventListener('mousemove', _domHoverHandler, true);
      global.document.addEventListener('keydown', _domEscHandler, true);
      if (ind) ind.textContent = '\u25C9 ON (hover, click to select, Esc to exit)';
    } else {
      _domInspectActive = false;
      global._domInspectActive = false;
      global.document.removeEventListener('click', _domClickHandler, true);
      global.document.removeEventListener('mousemove', _domHoverHandler, true);
      global.document.removeEventListener('keydown', _domEscHandler, true);
      if (typeof _domHoverHide === 'function') _domHoverHide();
      var selBtn = global.document.getElementById('mtapi-debug-inspect-btn');
      if (selBtn) { selBtn.style.background = ''; selBtn.style.color = ''; selBtn.style.borderColor = ''; }
      var aiBtn = global.document.getElementById('mtapi-debug-ai-snap-btn');
      if (aiBtn) aiBtn.disabled = true;
      var ov = global.document.getElementById('mtapi-debug-overlay');
      if (ov) ov.style.pointerEvents = '';
      if (ind) ind.textContent = '\u25CB off';
    }
  };
  function _domEscHandler(ev) { if (ev.key === 'Escape' || ev.keyCode === 27) { global._domInspectStop(); } }

  // ─── system info ──────────────────────────────────────────
  function refreshSystemInfo(){
    var el = global.document && global.document.getElementById('mtapi-debug-system-info'); if (!el) return;
    var rows = [];
    try { if (global.performance && global.performance.timing) rows.push({k:'Uptime (page)', v: Math.round((Date.now() - global.performance.timing.navigationStart) / 1000) + 's'}); else rows.push({k:'Uptime (page)', v:'n/a'}); } catch(e) { rows.push({k:'Uptime', v:e.message}); }
    rows.push({k:'Port', v:'7788 (default)'});
    try { if (global.performance && global.performance.memory) rows.push({k:'JS Heap', v: Math.round(global.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB / ' + Math.round(global.performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'}); else rows.push({k:'JS Heap', v:'n/a'}); } catch(e) { rows.push({k:'Memory', v:e.message}); }
    var procs = '';
    try { if (global.Android && typeof global.Android.processList === 'function') { procs = String(global.Android.processList()); } else { procs = 'n/a (Android bridge not available)'; } } catch(e) { procs = 'error: ' + e.message; }
    var html = '<table class="mtapi-debug-table"><tbody>';
    rows.forEach(function(r){
      html += '<tr><td style="color:#888;white-space:nowrap;vertical-align:top;width:120px;border-bottom:1px solid #1a1a1a">' + esc(r.k) + '</td><td style="border-bottom:1px solid #1a1a1a"><pre style="margin:0;white-space:pre-wrap;background:transparent;color:#aaa;font-size:11px;font-family:monospace">' + esc(r.v) + '</pre></td></tr>';
    });
    html += '<tr><td style="color:#888;vertical-align:top;border-bottom:1px solid #1a1a1a">Processes</td><td style="border-bottom:1px solid #1a1a1a"><pre style="margin:0;white-space:pre-wrap;background:transparent;color:#aaa;font-size:10px;font-family:monospace;max-height:300px;overflow:auto">' + esc(procs) + '</pre></td></tr>';
    html += '</tbody></table>';
    el.innerHTML = html;
  }
  global._fetchAppSource = function(){
    var el = global.document.getElementById('mtapi-debug-app-source'); if (!el) return;
    el.textContent = '(loading...)';
    var token = ''; try { var m = global.location.search.match(/[?&]token=([^&]+)/); if (m) token = m[1]; } catch(e) {}
    var url = '/app.js' + (token ? '?token=' + encodeURIComponent(token) : '');
    var f = global.fetch; if (!f) { el.textContent = '(no fetch)'; return; }
    f(url).then(function(r){ return r.text(); }).then(function(text){
      el.innerHTML = '<pre style="margin:0;white-space:pre-wrap;color:#aaa;font-size:10px">' + esc(text.slice(0, 50000)) + (text.length > 50000 ? '\n... (' + (text.length - 50000) + ' more)' : '') + '</pre>';
    }).catch(function(e){ el.textContent = '(error: ' + e.message + ')'; });
  };

  global._fetchDevToolsJSON = function(){
    var el = global.document && global.document.getElementById('mtapi-debug-devtools-json'); if (!el) return;
    el.innerHTML = '(loading...)';
    var token = ''; try { var m = global.location.search.match(/[?&]token=([^&]+)/); if (m) token = m[1]; } catch(e) {}
    var url = '/devtools/json' + (token ? '?token=' + encodeURIComponent(token) : '');
    var f = global.fetch; if (!f) { el.textContent = '(no fetch)'; return; }
    f(url).then(function(r){ return r.json(); }).then(function(j){
      if (typeof global.renderData === 'function') {
        try { el.innerHTML = global.renderData(j); return; } catch(e){}
      }
      el.innerHTML = '<pre style="margin:0;white-space:pre-wrap;color:#aaa">' + esc(JSON.stringify(j, null, 2)) + '</pre>';
    }).catch(function(e){ el.innerHTML = '<pre style="margin:0;color:#f66">(error: ' + esc(e.message) + ')</pre>'; });
  };

  // ─── chrome (FAB + overlay + tabs + side panel) ───────────
  var _activeTab = 'logs';
  var _tabs = ['logs', 'console', 'errors', 'logcat', 'devtools', 'system', 'network'];
  var _tabLabels = {logs:'Logs', console:'Console', errors:'Errors', logcat:'Logcat', devtools:'DevTools', system:'System', network:'Network'};

  global._setTab = function(name){
    if (_tabs.indexOf(name) === -1) return;
    _activeTab = name;
    var doc = global.document; if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.mtapi-debug-tabs button'), function(b){ b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    Array.prototype.forEach.call(doc.querySelectorAll('.mtapi-debug-sidepanel li'), function(li){ li.classList.toggle('active', li.getAttribute('data-tab') === name); });
    Array.prototype.forEach.call(doc.querySelectorAll('.mtapi-debug-content > [data-tab-content]'), function(c){ c.classList.toggle('active', c.getAttribute('data-tab-content') === name); });
    if (name === 'dom') global._domRefresh();
    if (name === 'logcat') global._logcatRefresh();
    if (name === 'system') { global._perfRefresh(); refreshSystemInfo(); }
    if (name === 'logs') global._netRefresh();
  };
  global._sidePanelToggle = function(){ var sp = global.document && global.document.getElementById('mtapi-debug-sidepanel'); if (sp) sp.classList.toggle('open'); };
  global._sidePanelClose = function(){ var sp = global.document && global.document.getElementById('mtapi-debug-sidepanel'); if (sp) sp.classList.remove('open'); };
  // ── Browser overlay (iframe + debug via same-origin proxy) ──
  var _browserHistory = [];
  var _browserHistoryIdx = -1;

  // ── Browser overlay (fetch-first + iframe fallback) ──
  var _browserHistory = [];
  var _browserHistoryIdx = -1;

  global._browserOpen = function(url) {
    var existing = global.document.getElementById('mtapi-browser-overlay');
    if (existing) { existing.remove(); }
    var u = url || '/help';
    var ov = global.document.createElement('div');
    ov.id = 'mtapi-browser-overlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999999;background:var(--bg,#1a1a1a);color:var(--fg,#ddd);display:flex;flex-direction:column;font-family:monospace;font-size:12px';
    ov.innerHTML = '<div id="mtapi-browser-header" style="display:flex;align-items:center;gap:4px;padding:6px 8px;background:var(--bg3,#222);border-bottom:1px solid var(--bg4,#444);flex-shrink:0">'
      + '<button id="mtapi-browser-api" class="icon-btn-sm accent" title="Back to MTAPI" style="width:16px;height:16px;font-size:12px;padding:0;display:inline-flex;align-items:center;justify-content:center">\u2699\uFE0F</button><span id="mtapi-browser-spinner" style="display:none;width:14px;height:14px;border:2px solid var(--bg4,#444);border-top-color:var(--accent,#4fc3f7);border-radius:50%;animation:mtapi-spin 0.8s linear infinite;flex-shrink:0"></span>'
      + '<button id="mtapi-browser-back" class="icon-btn-sm" title="Back" disabled>\u2190</button>'
      + '<input id="mtapi-browser-url" type="text" placeholder="URL..." value="' + esc(u) + '" style="flex:1;padding:4px 8px;background:var(--bg,#1a1a1a);color:var(--fg,#ddd);border:1px solid var(--bg4,#444);border-radius:3px;font-family:monospace;font-size:12px;min-width:0">'
      + '<button id="mtapi-browser-forward" class="icon-btn-sm" title="Forward" disabled>\u2192</button>'
      + '<button id="mtapi-browser-reload" class="icon-btn-sm accent" title="Reload">\u21BB</button>'
      + '<button id="mtapi-browser-debug" class="icon-btn-sm danger" title="Debug (inspect iframe content)">\uD83D\uDC1E</button>'
      + '</div>'
      + '<iframe id="mtapi-browser-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation" style="flex:1 1 0;border:0;background:#fff;min-height:0"></iframe>';
    if (!global.document.getElementById('mtapi-spin-style')) { var st = global.document.createElement('style'); st.id = 'mtapi-spin-style'; st.textContent = '@keyframes mtapi-spin { to { transform: rotate(360deg); } }'; global.document.head.appendChild(st); }
    global.document.body.appendChild(ov);

    var iframe = global.document.getElementById('mtapi-browser-iframe');
    var urlIn = global.document.getElementById('mtapi-browser-url');
    if (!global._mtapiBrowserNavListener) {
      global._mtapiBrowserNavListener = true;
      global.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'mtapi-nav' && e.data.url) {
          if (global._browserNavigate) global._browserNavigate(e.data.url);
        }
      });
    }
    var bBack = global.document.getElementById('mtapi-browser-back');
    var bFwd = global.document.getElementById('mtapi-browser-forward');
    var bReload = global.document.getElementById('mtapi-browser-reload');
    var bApi = global.document.getElementById('mtapi-browser-api');
    var bDebug = global.document.getElementById('mtapi-browser-debug');

    _browserHistory = [u];
    _browserHistoryIdx = 0;
    _browserUpdateButtons();

    function _nav(to) {
      if (!to) return;
      if (!/^(https?:\/\/|\/)/.test(to)) to = 'https://' + to;
      if (_browserHistory[_browserHistoryIdx] !== to) {
        _browserHistory = _browserHistory.slice(0, _browserHistoryIdx + 1);
        _browserHistory.push(to);
        _browserHistoryIdx = _browserHistory.length - 1;
      }
      urlIn.value = to;
      _browserUpdateButtons();
      _browserLoad(to);
    }
    function _browserUpdateButtons() {
      if (bBack) bBack.disabled = _browserHistoryIdx <= 0;
      if (bFwd) bFwd.disabled = _browserHistoryIdx >= _browserHistory.length - 1;
    }
    function _browserLoad(url) {
      if (!url) return;
      // Auto-add token for localhost (same-origin)
      if ((url.indexOf('/') === 0 || url.indexOf('127.0.0.1:7788') >= 0) && url.indexOf('token=') < 0) {
        var tok = (typeof global.TOKEN !== 'undefined') ? global.TOKEN : '';
        if (!tok) { try { var _m = global.location.search.match(/[?&]token=([^&]+)/); if (_m) tok = _m[1]; } catch(e) {} }
        if (!tok) { try { tok = global.localStorage.getItem('mtapi-token') || ''; } catch(e) {} }
        if (tok) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(tok);
      }
      var _spin = global.document.getElementById('mtapi-browser-spinner');
      if (_spin) _spin.style.display = 'inline-block';
      function _spinDone() { if (_spin) _spin.style.display = 'none'; }
      if (!/^(https?:\/\/|\/)/.test(url)) url = 'https://' + url;
      // Add to _browserHistory (for ←/→ buttons, not iframe.history)
      if (_browserHistory[_browserHistoryIdx] !== url) {
        _browserHistory = _browserHistory.slice(0, _browserHistoryIdx + 1);
        _browserHistory.push(url);
        _browserHistoryIdx = _browserHistory.length - 1;
      }
      if (global._browserUpdateButtons) global._browserUpdateButtons();
      // Local (same-origin) → iframe.src directly
      if (url.indexOf('/') === 0) {
        iframe.removeAttribute('srcdoc');
        iframe.src = url;
        return;
      }
      // Priority 1: Android.httpGet (Java DNS, no CORS, no X-Frame-Options)
      if (global.Android && global.Android.httpGet) {
        try {
          var html = String(global.Android.httpGet(url));
          if (html && html.indexOf('(error:') !== 0 && html.length > 100) {
            // Inject <base> + nav interceptor
            var base = '<base href="' + url + '">';
            if (html.indexOf('<head>') >= 0) html = html.replace('<head>', '<head>' + base);
            else if (html.indexOf('<HEAD>') >= 0) html = html.replace('<HEAD>', '<HEAD>' + base);
            else html = base + html;
            var nav = '<scr' + 'ipt>(function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a){var h=a.href;if(h&&h.indexOf("javascript:")!==0){e.preventDefault();try{parent.postMessage({type:"mtapi-nav",url:h},"*");}catch(x){}}}},true);})();</scr' + 'ipt>';
            if (html.indexOf('</body>') >= 0) html = html.replace('</body>', nav + '</body>');
            else html = html + nav;
            iframe.removeAttribute('src');
            iframe.srcdoc = html;
            _spinDone();
            return;
          }
        } catch(e) {}
      }
      // Fallback: /proxy-url (Go) → may fail (DNS in JNI)
      fetch('/proxy-url?url=' + encodeURIComponent(url))
        .then(function(r) { if (!r.ok) throw new Error('proxy ' + r.status); return r.text(); })
        .then(function(html) {
          iframe.removeAttribute('src');
          iframe.srcdoc = html;
          _spinDone();
        })
        .catch(function(err) {
          iframe.removeAttribute('srcdoc');
          iframe.src = url;
          _spinDone();
        });
    }

    global._browserNavigate = _nav;
    global._browserLoad = _browserLoad;
    global._browserBack = function() {
      if (_browserHistoryIdx > 0) { _browserHistoryIdx--; urlIn.value = _browserHistory[_browserHistoryIdx]; _browserUpdateButtons(); _browserLoad(_browserHistory[_browserHistoryIdx]); }
    };
    global._browserForward = function() {
      if (_browserHistoryIdx < _browserHistory.length - 1) { _browserHistoryIdx++; urlIn.value = _browserHistory[_browserHistoryIdx]; _browserUpdateButtons(); _browserLoad(_browserHistory[_browserHistoryIdx]); }
    };
    global._browserReload = function() { _browserLoad(_browserHistory[_browserHistoryIdx]); };
    global._browserClose = function() { var o = global.document.getElementById('mtapi-browser-overlay'); if (o) o.remove(); };

    if (bBack) bBack.onclick = global._browserBack;
    if (bFwd) bFwd.onclick = global._browserForward;
    if (bReload) bReload.onclick = global._browserReload;
    if (bApi) bApi.onclick = global._browserClose;
    if (urlIn) urlIn.onkeydown = function(e) { if (e.key === 'Enter') _nav(urlIn.value); };
    if (bDebug) bDebug.onclick = function() {
      if (global._debugOpen) { try { global._debugOpen(); } catch(e){} }
      if (global._mtapiToast) global._mtapiToast('Debug: use \uD83C\uDF10 tree (root=overlay) or right-click iframe → Inspect');
    };

    // nav messages from srcdoc iframe

    if (iframe) iframe.onload = function() { var sp = global.document.getElementById('mtapi-browser-spinner'); if (sp) sp.style.display = 'none'; };
    _browserLoad(u);
  };


  global._debugOpen = function(){ var ov = global.document && global.document.getElementById('mtapi-debug-overlay'); if (!ov) return; ov.removeAttribute('hidden'); global._setTab(_activeTab); global._domRootMode = 'overlay'; var _b = global.document.getElementById('mtapi-debug-root-toggle'); if (_b) _b.textContent = '\u25A3'; if (global._domRefresh) { try { global._domRefresh(); } catch(e){} } };
  global._debugClose = function(){ var ov = global.document && global.document.getElementById('mtapi-debug-overlay'); if (ov) ov.setAttribute('hidden', ''); global._sidePanelClose(); global._domRootMode = 'page'; var _b = global.document.getElementById('mtapi-debug-root-toggle'); if (_b) _b.textContent = '\uD83C\uDF10'; if (global._domRefresh) { try { global._domRefresh(); } catch(e){} } };

  var CSS = [
    '.mtapi-debug-fab-inline{width:16px;height:16px;border-radius:50%;border:1px solid var(--border,var(--bg4));background:var(--bg3,var(--bg3));color:var(--accent,var(--accent));font-size:10px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;line-height:1;font-family:inherit;margin:0;box-shadow:none}',
    '.mtapi-debug-fab-inline:hover{background:var(--bg4,#3a3a3a)}',
    '.mtapi-debug-back{font-weight:bold;letter-spacing:1px}',
    /* Force scroll everywhere */
    '.mtapi-debug-pre, #mtapi-debug-jslog, #mtapi-debug-logcat, #mtapi-debug-errors, #mtapi-debug-devtools-json, #mtapi-debug-network, #mtapi-debug-dom-tree, #mtapi-debug-dom-info, #mtapi-debug-system-info, #mtapi-debug-perf{overflow-y:scroll !important;overflow-x:auto !important;min-height:0;max-height:none}',
    '#mtapi-debug-eval-out{overflow-y:scroll !important;overflow-x:auto !important;white-space:pre !important;font-family:monospace;min-height:0;max-height:none !important}',
    '#mtapi-debug-eval-out pre, #mtapi-debug-eval-out table{min-width:max-content}',
                '.logcat-line{display:block;white-space:pre-wrap;word-break:break-all;padding:1px 4px;border-radius:2px}',
    '.logcat-line.lvl-v{color:#818cf8}',
    '.logcat-lvl{display:flex;gap:2px;margin-right:4px;align-items:center}',
    '.logcat-lvl label{cursor:pointer}',
    '.logcat-lvl input{display:none}',
    '.logcat-lvl span{display:inline-block;width:20px;height:20px;line-height:18px;text-align:center;border-radius:3px;font-family:monospace;font-size:10px;font-weight:600;border:1px solid var(--bg4);background:var(--bg);color:#555;user-select:none}',
    '.logcat-lvl input:checked + span.lvl-v{background:#6366f1;color:#fff;border-color:#6366f1}',
    '.logcat-lvl input:checked + span.lvl-d{background:#22c55e;color:#fff;border-color:#22c55e}',
    '.logcat-lvl input:checked + span.lvl-i{background:#06b6d4;color:#fff;border-color:#06b6d4}',
    '.logcat-lvl input:checked + span.lvl-w{background:#f59e0b;color:#fff;border-color:#f59e0b}',
    '.logcat-lvl input:checked + span.lvl-e{background:#ef4444;color:#fff;border-color:#ef4444}',
    '.logcat-lvl input:checked + span.lvl-f{background:#dc2626;color:#fff;border-color:#dc2626;font-weight:800}',
    '.logcat-line.lvl-d{color:#4ade80}',
    '.logcat-line.lvl-i{color:#22d3ee}',
    '.logcat-line.lvl-w{color:#fbbf24;background:rgba(251,191,36,.08)}',
    '.logcat-line.lvl-e{color:#f87171;background:rgba(248,113,113,.08)}',
    '.logcat-line.lvl-f{color:#fff;background:#dc2626;font-weight:600}',
    '.logcat-hl{background:#fbbf24;color:#000;padding:0 1px;border-radius:2px;font-weight:600}',
    '.logcat-line.lvl-w .logcat-hl{background:#fde68a}',
    '.logcat-line.lvl-e .logcat-hl{background:#fca5a5}',
    '.logcat-line.lvl-f .logcat-hl{background:#fff}',
    'mark.tbl-hl{background:#ffeb3b;color:#000;padding:0 1px;border-radius:2px}',
    'button.copy{background:#3a3a3a;color:var(--fg);border:1px solid #555;border-radius:3px;padding:2px 8px;font-family:monospace;font-size:11px;cursor:pointer}',
    'button.copy:hover{background:#4a4a4a}',
    'button.clear{background:#4a2020;color:#f88;border:1px solid #733;border-radius:3px;padding:2px 8px;font-family:monospace;font-size:11px;cursor:pointer}',
    'button.clear:hover{background:#6a2020}',
    '.proc-search,.tbl-search{flex:1;min-width:80px;padding:3px 6px;background:#000;color:var(--fg);border:1px solid var(--bg4);border-radius:3px;font-family:monospace;font-size:11px}',
    '.proc-search:focus,.tbl-search:focus{outline:1px solid var(--accent);border-color:var(--accent)}',
    '.tbl-toolbar{display:flex;gap:4px;align-items:center;margin:4px 0}',
    '.mtapi-debug-fab{position:fixed;top:8px;right:8px;z-index:999999;width:16px;height:16px;border-radius:50%;border:1px solid var(--bg4);background:var(--bg3);color:var(--accent);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);padding:0;line-height:1;font-family:monospace}',
    '.mtapi-debug-fab:hover{background:#3a3a3a}',
    '.mtapi-debug-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999998;background:var(--bg);color:var(--fg);font-family:monospace;font-size:12px;display:flex;flex-direction:column}',
    '.mtapi-debug-overlay[hidden]{display:none}',
    '.mtapi-debug-topbar{display:flex;align-items:center;padding:4px 8px;background:var(--bg3);border-bottom:1px solid var(--bg4);gap:8px;flex-shrink:0}',
    '.mtapi-debug-topbar button{background:transparent;color:var(--fg);border:1px solid var(--bg4);border-radius:3px;padding:2px 8px;font-family:monospace;font-size:12px;cursor:pointer}',
    '.mtapi-debug-topbar button:hover{background:var(--bg4)}',
    '.mtapi-debug-topbar-row1{padding:6px 8px;border-bottom:1px solid var(--bg4)}',
    '.mtapi-debug-topbar-row2{padding:4px 8px;border-bottom:1px solid var(--bg4);overflow-x:auto;flex-shrink:0}',
    '.mtapi-debug-tabs{display:flex;gap:2px;flex:1;overflow-x:auto;min-width:0}',
    '.mtapi-debug-tabs button.active{background:var(--bg4);border-color:#666}',
    '.mtapi-debug-content{flex:1;overflow:auto;padding:8px;position:relative;display:flex;flex-direction:column;min-height:0}',
    '.mtapi-debug-content > [data-tab-content]{display:none}',
    '.mtapi-debug-content > [data-tab-content].active{display:flex;flex-direction:column;flex:1 1 0 !important;min-height:0;height:100% !important;gap:8px}',
    '.mtapi-debug-sidepanel{position:absolute;top:0;right:0;bottom:0;width:200px;background:var(--bg3);border-left:1px solid var(--bg4);padding:8px;transform:translateX(100%);transition:transform 0.2s;box-shadow:-2px 0 6px rgba(0,0,0,0.4)}',
    '.mtapi-debug-sidepanel.open{transform:translateX(0)}',
    '.mtapi-debug-sidepanel h3{margin:0 0 8px 0;font-size:12px;color:var(--fg3);font-weight:normal}',
    '.mtapi-debug-sidepanel ul{list-style:none;padding:0;margin:8px 0 0 0}',
    '.mtapi-debug-sidepanel li{padding:6px 8px;cursor:pointer;border-radius:3px;font-size:12px}',
    '.mtapi-debug-sidepanel li:hover{background:var(--bg4)}',
    '.mtapi-debug-sidepanel li.active{background:var(--bg4)}',
    '.mtapi-debug-section{border:1px solid var(--bg4);border-radius:3px;margin:0;background:var(--bg2);display:flex;flex-direction:column;overflow:hidden}',
    '.mtapi-debug-flat{flex:1 1 0;min-height:0;display:flex;flex-direction:column;background:var(--bg2);border:1px solid var(--bg4);border-radius:3px;overflow:hidden}',
    '.mtapi-debug-flat-hdr{padding:4px 8px;background:var(--bg3);border-bottom:1px solid var(--bg4);font-size:11px;color:var(--fg3);flex-shrink:0}',
    '.mtapi-debug-flat > .mtapi-debug-pre,.mtapi-debug-flat > div[id$="-jslog"],.mtapi-debug-flat > div[id$="-errors"],.mtapi-debug-flat > div[id$="-logcat"],.mtapi-debug-flat > div[id$="-eval-out"]{flex:1 1 0;min-height:0;overflow:auto}',
    '.mtapi-debug-section[open]{flex:1 1 auto;min-height:200px;resize:vertical}',
    '.mtapi-debug-section[data-flat="1"]{flex:1 1 0 !important;min-height:0 !important;max-height:none !important;resize:none !important;overflow:hidden !important;display:flex !important;flex-direction:column !important;height:100% !important}',
    '.mtapi-debug-section[data-flat="1"] > summary{display:none !important}',
    '.mtapi-debug-section[data-flat="1"] > .mtapi-debug-toolbar{flex-shrink:0 !important}',
    '.mtapi-debug-section[data-flat="1"] > .mtapi-debug-pre,.mtapi-debug-section[data-flat="1"] > div[id]{flex:1 1 0 !important;min-height:0 !important;max-height:none !important;overflow:auto !important;height:auto !important}',
    '.mtapi-debug-section:not([open]){flex:0 0 auto;min-height:0;resize:none}',
    '.mtapi-debug-section > summary{flex-shrink:0}',
    '.mtapi-debug-section > .mtapi-debug-pre,.mtapi-debug-section > div[id$="-network"],.mtapi-debug-section > .mtapi-debug-dom-split{flex:1 1 auto;min-height:0}',
    '.mtapi-debug-section > .mtapi-debug-toolbar{flex-shrink:0}',
    '.mtapi-debug-dom-split{flex:1 1 auto;min-height:200px}',
    '.mtapi-debug-section > summary{padding:4px 8px;background:var(--bg3);cursor:pointer;border-bottom:1px solid var(--bg4);font-size:11px}',
    '.mtapi-debug-pre{flex:1 1 auto;min-height:80px;max-height:none;overflow:auto;background:#000;color:#0f0;padding:4px;margin:0;font-size:11px;white-space:normal}',
    '#mtapi-debug-jslog{flex:1 1 0;min-height:60px;max-height:none;overflow-y:scroll !important;overflow-x:scroll !important;resize:vertical;background:#000;padding:4px;border:1px solid var(--bg4)}',
                'pre.mtapi-debug-pre,.mtapi-debug-pre > pre{white-space:pre-wrap}',
    '.mtapi-debug-pre > table{min-width:max-content}',
                                    '#mtapi-debug-network{min-height:200px;max-height:600px;overflow:auto;resize:vertical;background:var(--bg2);padding:4px;border:1px solid var(--bg4)}',
                    '#mtapi-debug-network thead th{position:sticky;top:0;background:var(--bg3);z-index:1}',
    '#mtapi-debug-network table{min-width:100%}',
    '.net-body-cell{padding:0!important}',
    '.net-body-json{max-height:400px;min-height:80px;overflow:auto;resize:vertical;background:var(--bg2);padding:4px;border:1px solid var(--bg4);font-size:10px;margin:2px 0}',
                '.net-body-json table{width:100%;border-collapse:collapse;margin:2px 0}',
    '.net-body-json th,.net-body-json td{border:1px solid var(--bg4);padding:2px 4px;font-size:10px;vertical-align:top}',
    '.net-body-json th{background:var(--bg3);color:var(--fg3);font-weight:normal;text-align:left}',
    '.net-body-json details.sub{border:1px solid var(--bg4);border-radius:3px;padding:2px;margin:2px 0}',
    '.net-body-json details.sub > summary{padding:2px;cursor:pointer;color:var(--accent);font-size:10px}',
    '.net-body-pre{max-height:300px;overflow:auto;background:#000;color:var(--fg2);padding:2px;margin:0;font-size:9px;white-space:pre-wrap;resize:vertical}',
    'div.mtapi-debug-pre{overflow:auto;resize:vertical;white-space:normal}',
    '.mtapi-debug-table{width:100%;border-collapse:collapse;font-family:monospace;font-size:11px;background:#000}',
    '.mtapi-debug-table th{position:sticky;top:0;background:var(--bg3);color:var(--fg3);text-align:left;padding:2px 4px;font-weight:normal;z-index:1;border-bottom:1px solid var(--bg4)}',
    '.mtapi-debug-table td{padding:1px 4px;border-bottom:1px solid var(--bg);vertical-align:top}',
    '.mtapi-debug-table tr:hover td{background:#151515}',
    '.mtapi-debug-table .lvl-ind{width:16px;text-align:center;font-weight:600}',
    '.mtapi-debug-table .lvl-ind.lvl-v{color:#818cf8}',
    '.mtapi-debug-table .lvl-ind.lvl-d{color:#4ade80}',
    '.mtapi-debug-table .lvl-ind.lvl-i{color:#22d3ee}',
    '.mtapi-debug-table .lvl-ind.lvl-w{color:#fbbf24;background:rgba(251,191,36,.08)}',
    '.mtapi-debug-table .lvl-ind.lvl-e{color:#f87171;background:rgba(248,113,113,.08)}',
    '.mtapi-debug-table .lvl-ind.lvl-f{color:#fff;background:#dc2626}',
    '.mtapi-debug-table .logcat-line{white-space:pre-wrap;word-break:break-all}',
    '.mtapi-debug-sidepanel h3{display:flex;justify-content:space-between;align-items:center;margin:0 0 8px 0}',
    '.mtapi-debug-sidepanel .sp-close{background:transparent;color:#f88;border:none;font-size:20px;cursor:pointer;padding:0 4px;line-height:1}',
    '.mtapi-debug-sidepanel .sp-close:hover{color:#f44}',
    'button.icon-btn-sm{background:var(--bg3);color:var(--fg);border:1px solid var(--bg4);border-radius:3px;padding:2px 6px;font-family:monospace;font-size:13px;cursor:pointer;line-height:1;min-width:26px;height:24px}',
    'button.icon-btn-sm:hover{background:#3a3a3a}',
    'button.icon-btn-sm:disabled{opacity:0.6;cursor:not-allowed;background:#444 !important;color:#888 !important;border-color:#555 !important}',
    'button.icon-btn-sm.danger{color:#f88}',
    'button.icon-btn-sm.accent{color:var(--accent)}',
    '.mtapi-debug-toolbar{display:flex;gap:4px;align-items:center;margin:4px 0;flex-wrap:wrap}',
    '.mtapi-debug-toolbar input{flex:1;min-width:80px}',
    '.mtapi-debug-dom-split{display:flex;gap:8px;min-height:200px;flex:1 1 0;overflow:hidden}',
    '.mtapi-debug-dom-tree-wrap{flex:1;overflow:auto;background:#000;padding:4px;border:1px solid #333;resize:both}',
    '.mtapi-debug-dom-info-wrap{width:280px;overflow:auto;background:#0d0d0d;padding:4px;border:1px solid #333;font-size:11px;resize:horizontal}',
    '.mtapi-debug-dom-tree-wrap{flex:1;overflow:auto;background:#000;padding:4px;border:1px solid var(--bg4)}',
    '.mtapi-debug-resize-edge:hover{background:var(--accent,#4fc3f7) !important;opacity:0.5}',
    '#mtapi-debug-dom-info::-webkit-scrollbar{width:10px;height:10px;background:var(--bg3,#222)}',
    '#mtapi-debug-dom-info::-webkit-scrollbar-thumb{background:var(--fg3,#888);border-radius:5px}',
    '#mtapi-debug-dom-tree::after, #mtapi-debug-dom-info::after{content:"";position:absolute;right:2px;bottom:2px;width:10px;height:10px;background:linear-gradient(135deg,transparent 50%,var(--accent,#4fc3f7) 50%);pointer-events:none;opacity:0.6}',
    '#mtapi-debug-dom-tree::-webkit-scrollbar{width:10px;height:10px;background:var(--bg3,#222)}',
    '#mtapi-debug-dom-tree::-webkit-scrollbar-thumb{background:var(--fg3,#888);border-radius:5px}',
    '.mtapi-debug-dom-info-wrap{width:280px;overflow:auto;background:var(--bg2);padding:4px;border:1px solid var(--bg4);font-size:11px}',
    /* ── SCROLLBARS (force) ── */
    '.mtapi-debug-pre, #mtapi-debug-jslog, #mtapi-debug-logcat, #mtapi-debug-errors, #mtapi-debug-eval-out, #mtapi-debug-devtools-json, #mtapi-debug-system-info, #mtapi-debug-perf{max-height:60vh !important;overflow-y:scroll !important;overflow-x:auto !important;scrollbar-width:thin;scrollbar-color:var(--fg3) var(--bg3)}',
    '.mtapi-debug-pre::-webkit-scrollbar, #mtapi-debug-jslog::-webkit-scrollbar, #mtapi-debug-logcat::-webkit-scrollbar, #mtapi-debug-errors::-webkit-scrollbar, #mtapi-debug-eval-out::-webkit-scrollbar, #mtapi-debug-devtools-json::-webkit-scrollbar, #mtapi-debug-system-info::-webkit-scrollbar, #mtapi-debug-perf::-webkit-scrollbar{width:14px;height:14px;background:var(--bg)}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb, #mtapi-debug-jslog::-webkit-scrollbar-thumb, #mtapi-debug-logcat::-webkit-scrollbar-thumb, #mtapi-debug-errors::-webkit-scrollbar-thumb, #mtapi-debug-eval-out::-webkit-scrollbar-thumb, #mtapi-debug-devtools-json::-webkit-scrollbar-thumb, #mtapi-debug-system-info::-webkit-scrollbar-thumb, #mtapi-debug-perf::-webkit-scrollbar-thumb{background:var(--fg3);border-radius:7px;border:2px solid var(--bg)}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb:hover, #mtapi-debug-jslog::-webkit-scrollbar-thumb:hover, #mtapi-debug-logcat::-webkit-scrollbar-thumb:hover{background:#bbb}',
    '.mtapi-debug-pre::-webkit-scrollbar-track, #mtapi-debug-jslog::-webkit-scrollbar-track, #mtapi-debug-logcat::-webkit-scrollbar-track{background:var(--bg)}',
    /* network / dom / sidepanel тоже */
    '#mtapi-debug-network, #mtapi-debug-dom-tree, #mtapi-debug-dom-info{max-height:60vh !important;overflow-y:scroll !important;overflow-x:auto !important;scrollbar-width:thin;scrollbar-color:var(--fg3) var(--bg3)}',
    '#mtapi-debug-network::-webkit-scrollbar, #mtapi-debug-dom-tree::-webkit-scrollbar, #mtapi-debug-dom-info::-webkit-scrollbar{width:14px;height:14px;background:var(--bg)}',
    '#mtapi-debug-network::-webkit-scrollbar-thumb, #mtapi-debug-dom-tree::-webkit-scrollbar-thumb, #mtapi-debug-dom-info::-webkit-scrollbar-thumb{background:var(--fg3);border-radius:7px;border:2px solid var(--bg)}',
  ].join('\n');

  function buildTabContents(){
    var p1 = '';
    for(var i=global._jslogBuf.length-1;i>=0;i--){ var e=global._jslogBuf[i]; p1 += esc(fmtTime(e.t)+' ['+(e.lvl||'log')+'] '+e.m)+'\n'; }
    var p3 = '';
    try{ var er=JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]'); p3=er.map(function(x){return fmtTime(x.t)+' ['+x.lvl+'] '+x.m;}).join('\n'); }catch(x){}

    var html = '';

    // ── Logs ──
    html += '<div data-tab-content="logs" class="' + (_activeTab==='logs'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-flat="1" data-refresh="jslog"><summary>JS Logs <span id="mtapi-debug-jslog-count">('+global._jslogBuf.length+')</span></summary>';
    html += '<div class="mtapi-debug-toolbar">';
    html += '<div class="logcat-lvl" id="mtapi-debug-jslog-lvl" title="filter by level">';
    html += '<label><input type="checkbox" data-lvl="v" checked onchange="window._jslogFilter&&window._jslogFilter()"><span class="lvl-v">V</span></label>';
    html += '<label><input type="checkbox" data-lvl="d" checked onchange="window._jslogFilter&&window._jslogFilter()"><span class="lvl-d">D</span></label>';
    html += '<label><input type="checkbox" data-lvl="i" checked onchange="window._jslogFilter&&window._jslogFilter()"><span class="lvl-i">I</span></label>';
    html += '<label><input type="checkbox" data-lvl="w" checked onchange="window._jslogFilter&&window._jslogFilter()"><span class="lvl-w">W</span></label>';
    html += '<label><input type="checkbox" data-lvl="e" checked onchange="window._jslogFilter&&window._jslogFilter()"><span class="lvl-e">E</span></label>';
    html += '</div>';
    html += _iconSearch('mtapi-debug-jslog-search', "window._refreshJslogQuery&&window._refreshJslogQuery()");
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyJslog&&window._copyJslog()");
    html += _iconBtn('\uD83D\uDDD1', 'Clear', "window._jslogBuf=[];window._jslogClear&&window._jslogClear()", 'danger');
    html += '</div>';
    html += '<div id="mtapi-debug-jslog" class="mtapi-debug-pre">'+(_renderJslogWithQuery ? _renderJslogWithQuery('') : p1)+'</div>';
    html += '</details>';
    html += '</div>';

    // ── Console ──
    html += '<div data-tab-content="console" class="' + (_activeTab==='console'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-flat="1"><summary>Console Eval</summary>';
    html += '<div style="margin:4px 0;display:flex;gap:4px;align-items:center;flex-wrap:wrap"><textarea class="mtapi-dbg-eval-input" placeholder="JS (multiline, Ctrl+Enter to run)..." rows="3" style="flex:1 1 100%;padding:6px;background:#000;color:#ddd;border:1px solid #444;font-family:monospace;resize:vertical;min-height:60px;max-height:40vh"></textarea><button onclick="window._evalConsole()">\u25B6</button><button class="icon-btn-sm" aria-label="Copy" title="Copy output" onclick="window._evalCopy&&window._evalCopy()">\uD83D\uDCCB</button><button class="icon-btn-sm danger" aria-label="Clear" title="Clear output" onclick="window._evalClear&&window._evalClear()">\uD83D\uDDD1</button><button class="icon-btn-sm" aria-label="Help" title="Help" onclick="window._evalHelp&&window._evalHelp()">?</button><button class="icon-btn-sm" aria-label="DOM" title="Floating DOM tree" onclick="window._domShowFloating&&window._domShowFloating()">\uD83C\uDF33</button></div>';
    html += '<div id="mtapi-debug-eval-out" class="mtapi-debug-pre" style="color:#ddd">\u2014</div>';
    html += '</details>';
    html += '</div>';

    // ── Errors ──
    html += '<div data-tab-content="errors" class="' + (_activeTab==='errors'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-flat="1" data-refresh="errors"><summary>Errors (persistent)</summary>';
    html += '<div class="mtapi-debug-toolbar">';
    html += _iconSearch('mtapi-debug-errors-search', "window._refreshErrorsQuery&&window._refreshErrorsQuery()");
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyErrors&&window._copyErrors()");
    html += _iconBtn('\uD83D\uDDD1', 'Clear', "window._errorsClear&&window._errorsClear()", 'danger');
    html += '</div>';
    html += '<div id="mtapi-debug-errors" class="mtapi-debug-pre" style="color:#f66">'+(_renderErrorsWithQuery ? _renderErrorsWithQuery('') : esc(p3))+'</div>';
    html += '</details>';
    html += '</div>';

    // ── Logcat ──
    html += '<div data-tab-content="logcat" class="' + (_activeTab==='logcat'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-flat="1" data-refresh="logcat"><summary>Logcat</summary>';
    html += '<div class="mtapi-debug-toolbar">';
    html += '<div class="logcat-lvl" title="filter by level">';
    html += '<label><input type="checkbox" data-lvl="v" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-v">V</span></label>';
    html += '<label><input type="checkbox" data-lvl="d" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-d">D</span></label>';
    html += '<label><input type="checkbox" data-lvl="i" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-i">I</span></label>';
    html += '<label><input type="checkbox" data-lvl="w" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-w">W</span></label>';
    html += '<label><input type="checkbox" data-lvl="e" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-e">E</span></label>';
    html += '</div>';
    html += _iconSearch('mtapi-debug-logcat-search', "window._refreshLogcatQuery&&window._refreshLogcatQuery()");
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyLogcat&&window._copyLogcat()");
    html += _iconBtn('\u21BB', 'Refresh', "window._logcatRefresh&&window._logcatRefresh()", 'accent');
    html += '</div>';
    html += '<div id="mtapi-debug-logcat" class="mtapi-debug-pre" style="color:#aaa;font-size:10px">'+renderLogcat()+'</div>';
    html += '</details>';
    html += '</div>';

    // ── DevTools ──
    html += '<div data-tab-content="devtools" class="' + (_activeTab==='devtools'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="devtools"><summary>WebView DevTools</summary><div style="padding:8px;line-height:1.6">';
    html += '<p><b>On PC (via adb):</b></p><code>adb shell pidof dev.mtapi</code><br><code>adb forward tcp:9222 localabstract:webview_devtools_remote_&lt;PID&gt;</code><br><code>chrome://inspect/#devices</code>';
    html += '<p><b>On device (JSON):</b></p><button class="copy" onclick="window._fetchDevToolsJSON()">\u21BB GET /devtools/json</button>';
    html += '<div id="mtapi-debug-devtools-json" class="mtapi-debug-pre" style="color:#aaa;margin-top:4px">(click button)</div>';
    html += '<p><b>App source (app.js):</b></p><button class="copy" onclick="window._fetchAppSource&&window._fetchAppSource()">\uD83D\uDCC4 Load app.js</button>';
    html += '<div id="mtapi-debug-app-source" class="mtapi-debug-pre" style="color:#aaa;max-height:300px;overflow:auto;margin-top:4px">(click button)</div>';
    html += '</div></details>';
    html += '</div>';

    // ── System ──
    html += '<div data-tab-content="system" class="' + (_activeTab==='system'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="perf" style="flex:0 0 auto"><summary>Performance</summary><div style="margin:4px 0"><button class="copy" onclick="window._perfReset()">\uD83D\uDD04 Reset</button></div><div id="mtapi-debug-perf" class="mtapi-debug-pre" style="color:#ddd;min-height:60px;max-height:200px">'+renderPerf()+'</div></details>';
    html += '<details class="mtapi-debug-section" open data-refresh="system" style="flex:1 1 0"><summary>System info</summary><div style="padding:2px 8px;font-size:10px;color:#888;border-bottom:1px solid #222">Refresh: tap \u27F3 above, or collapse/expand this section (auto-refresh on toggle). Data loads on tab open.</div><div id="mtapi-debug-system-info" class="mtapi-debug-pre" style="color:#aaa">(loading...)</div></details>';
    html += '</div>';

    // ── Network ──
    html += '<div data-tab-content="network" class="' + (_activeTab==='network'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-flat="1" data-refresh="network"><summary>Requests <span id="mtapi-debug-net-count">('+global._netBuf.length+')</span></summary>';
    html += '<div class="mtapi-debug-toolbar">';
    html += '<label style="font-size:10px"><input type="checkbox" id="mtapi-debug-netverbose" '+((global._netVerbose===true)?'checked':'')+' onchange="window._netVerbose=this.checked"> verbose</label>';
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyNetwork&&window._copyNetwork()");
    html += _iconBtn('\uD83D\uDDD1', 'Clear', "window._netClear&&window._netClear()", 'danger');
    html += '</div>';
    html += '<div id="mtapi-debug-network">'+renderNetwork()+'</div>';
    html += '</details>';
    html += '</div>';

    return html;
  }

  function buildChrome(){
    var doc = global.document; if (!doc) return null;
    var existing = doc.getElementById('mtapi-debug-overlay');
    if (existing) return existing;

    var style = doc.createElement('style');
    style.setAttribute('data-mtapi-debug-style', '');
    style.textContent = CSS;
    doc.head.appendChild(style);

    var ov = doc.createElement('div');
    ov.id = 'mtapi-debug-overlay';
    ov.className = 'mtapi-debug-overlay';
    ov.setAttribute('hidden', '');

    // ── row 1: [MTAPI] + [🐞] ──
    var row1 = doc.createElement('div');
    row1.className = 'mtapi-debug-topbar mtapi-debug-topbar-row1';

    var backBtn = doc.createElement('button');
    backBtn.id = 'mtapi-debug-back';
    backBtn.className = 'mtapi-debug-back';
    backBtn.textContent = '\u2699\uFE0F';
    backBtn.style.cssText = 'width:16px;height:16px;font-size:12px;padding:0;display:inline-flex;align-items:center;justify-content:center';
    backBtn.title = 'Back to app';
    backBtn.setAttribute('onclick', 'window._debugClose()');
    row1.appendChild(backBtn);

    var spacer = doc.createElement('div');
    spacer.style.cssText = 'flex:1';
    row1.appendChild(spacer);

    var menuBtn = doc.createElement('button');
    menuBtn.id = 'mtapi-debug-menu';
    menuBtn.className = 'mtapi-debug-menu';
    menuBtn.textContent = '\uD83D\uDC1E';
    menuBtn.title = 'Tabs menu';
    menuBtn.setAttribute('onclick', 'window._sidePanelToggle()');
    row1.appendChild(menuBtn);

    ov.appendChild(row1);

    // ── row 2: tabs ──
    var row2 = doc.createElement('div');
    row2.className = 'mtapi-debug-topbar mtapi-debug-topbar-row2';

    var tabsDiv = doc.createElement('div');
    tabsDiv.className = 'mtapi-debug-tabs';
    _tabs.forEach(function(t){
      var b = doc.createElement('button');
      b.textContent = _tabLabels[t] || t;
      b.setAttribute('data-tab', t);
      b.setAttribute('onclick', 'window._setTab("' + t + '")');
      if (t === _activeTab) b.classList.add('active');
      tabsDiv.appendChild(b);
    });
    row2.appendChild(tabsDiv);
    ov.appendChild(row2);

    var content = doc.createElement('div');
    content.className = 'mtapi-debug-content';
    content.innerHTML = buildTabContents();
    ov.appendChild(content);

    var sp = doc.createElement('div');
    sp.id = 'mtapi-debug-sidepanel';
    sp.className = 'mtapi-debug-sidepanel';
    var spHtml = '<h3>Tabs<button class="sp-close" aria-label="Close" title="Close" onclick="window._sidePanelClose()">\u00D7</button></h3><ul>';
    _tabs.forEach(function(t){
      spHtml += '<li data-tab="' + t + '"' + (t === _activeTab ? ' class="active"' : '') + ' onclick="window._setTab(\'' + t + '\');window._sidePanelClose()">' + (_tabLabels[t] || t) + '</li>';
    });
    spHtml += '</ul>';
    sp.innerHTML = spHtml;
    ov.appendChild(sp);

    var fab = doc.createElement('button');
    fab.id = 'mtapi-debug-fab';
    fab.className = 'mtapi-debug-fab';
    fab.textContent = '\uD83D\uDC1E';
    fab.title = 'Open debug';
    fab.setAttribute('onclick', 'window._debugOpen()');

    var host = CONFIG.container || doc.body;
    var headerRight = doc.querySelector('.head-right');
    if (headerRight && !CONFIG.container) {
      fab.className = 'mtapi-debug-fab-inline';
      headerRight.appendChild(fab);
    } else {
      fab.className = 'mtapi-debug-fab';
      host.appendChild(fab);
    }
    host.appendChild(ov);
    _installToggleListener(doc);

    return ov;
  }

  // ─── public API ───────────────────────────────────────────
  function _installToggleListener(doc){
    if (!doc || doc.__mtapiToggleInstalled) return;
    doc.__mtapiToggleInstalled = true;
    doc.addEventListener('toggle', function(ev){
      var el = ev.target;
      if (!el || el.tagName !== 'DETAILS' || !el.open) return;
      var r = el.getAttribute('data-refresh');
      if (!r) return;
      if (r === 'network') { global._netRefresh && global._netRefresh(); }
      else if (r === 'errors') { global._errorsClear && 0; var pre=doc.getElementById('mtapi-debug-errors'); if(pre){try{var er=JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]');pre.textContent=er.map(function(x){return fmtTime(x.t)+' ['+x.lvl+'] '+x.m;}).join('\n');}catch(e){}} }
      else if (r === 'perf') { global._perfRefresh && global._perfRefresh(); }
      else if (r === 'logcat') { global._logcatRefresh && global._logcatRefresh(); }
      else if (r === 'jslog') { global._refreshJslogQuery && global._refreshJslogQuery(); }
      else if (r === 'devtools') { /* noop — fetch on click */ }
      else if (r === 'system') { try { refreshSystemInfo(); } catch(e){} }
    }, true);
  }

  global.MtapiDebug = {
    attach: function(o){
      global._mtapiAttachStart = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
      o = o || {};
      for(var k in o) if(Object.prototype.hasOwnProperty.call(o,k)) CONFIG[k] = o[k];
      var ov = buildChrome();
      if (!ov) return null;
      global._netRefresh();
      global._perfRefresh();
      refreshSystemInfo();
      // EventBus (like OWI open-web-inspector-*)
      if (!global._mtapiDebugEventsInstalled) {
        global._mtapiDebugEventsInstalled = true;
        global.document.addEventListener('mtapi-debug-inspect', function(e) {
          if (e.detail && e.detail.enable === true) { if (!global._domInspectActive) global._domInspect(); }
          else if (e.detail && e.detail.enable === false) { if (global._domInspectActive) global._domInspect(); }
          else { global._domInspect(); }
        });
        global.document.addEventListener('mtapi-debug-select', function(e) {
          if (e.detail && e.detail.selector) {
            var el = global.document.querySelector(e.detail.selector);
            if (el) { if (!global._domInspectActive) global._domInspect(); inspectElement(el); }
          } else if (e.detail && e.detail.element) {
            if (!global._domInspectActive) global._domInspect(); inspectElement(e.detail.element);
          }
        });
      }
      if (!global.MtapiDebug.selectElement) {
        global.MtapiDebug.selectElement = function(sel) {
          var el = global.document.querySelector(sel);
          if (!el) return false;
          if (!global._domInspectActive) global._domInspect();
          inspectElement(el);
          return true;
        };
      }
      var _bb = global.document.getElementById("browser-btn"); if (_bb) _bb.onclick = function(){ global._browserOpen && global._browserOpen(); };
      if (!global._mtapiEvalMdBound) {
        global._mtapiEvalMdBound = true;
        global.document.addEventListener('keydown', function(e) {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            var el = e.target;
            if (el && el.classList && el.classList.contains('mtapi-dbg-eval-input') && global._evalConsole) {
              e.preventDefault(); global._evalConsole();
            }
          }
        }, true);
      }
      // Auto-add token to same-origin fetches (Console Eval convenience)
      if (!global._mtapiFetchPatched && global.fetch) {
        global._mtapiFetchPatched = true;
        var _origFetch = global.fetch;
        global.fetch = function(url, opts) {
          try {
            if (typeof url === 'string' && url.charAt(0) === '/' && url.indexOf('token=') < 0) {
              var _tok = (typeof global.TOKEN !== 'undefined') ? global.TOKEN : '';
              if (!_tok) { try { var _m = global.location.search.match(/[?&]token=([^&]+)/); if (_m) _tok = _m[1]; } catch(e) {} }
              if (_tok) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(_tok);
            }
          } catch(e) {}
          return _origFetch.call(global, url, opts);
        };
      }
      global._setTab(_activeTab);
      try { global._jslogLiveStart(2000); setTimeout(function(){ if (global._evalHelp) global._evalHelp(); }, 100); } catch(e){}
      return ov;
    },
    log: function(lvl){ push(lvl, Array.prototype.slice.call(arguments, 1)); },
    perf: function(label, ms){ if(!global._mtapiCustomPerf) global._mtapiCustomPerf={}; global._mtapiCustomPerf[label]=Math.round(ms*100)/100; if(global._perfRefresh) global._perfRefresh(); return label+': '+ms+'ms'; },
    time: function(label){ if(!global._mtapiTimers) global._mtapiTimers={}; global._mtapiTimers[label]=(global.performance&&global.performance.now)?global.performance.now():Date.now(); return 'started: '+label; },
    timeEnd: function(label){ if(!global._mtapiTimers||global._mtapiTimers[label]==null) return 'no timer: '+label; var ms=((global.performance&&global.performance.now)?global.performance.now():Date.now())-global._mtapiTimers[label]; delete global._mtapiTimers[label]; return global.MtapiDebug.perf(label,ms); },
    buffer: function(){ return global._jslogBuf.slice(); },
    errors: function(){ try{return JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]');}catch(e){return [];} },
    open: global._debugOpen,
    close: global._debugClose,
    setTab: global._setTab,
    version: '0.2.0'
  };

})(typeof window !== 'undefined' ? window : globalThis);

// MTAPI_PERSIST_ERR_CLEAR: clear persistent errors from localStorage.
if (typeof window !== 'undefined') {
  window._persistErrorsClear = function() {
    try { window.localStorage.removeItem('mtapi-errors'); } catch(e) {}
    try { var pre = window.document.getElementById('mtapi-debug-errors'); if (pre) pre.textContent = ''; } catch(e) {}
  };
}
