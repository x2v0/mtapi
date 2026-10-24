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
    var o = '';
    var p = global._perf || {};
    if (p.render != null) o += 'render()       : ' + p.render + 'ms\n';
    if (p.reloadLogcat != null) o += 'reloadLogcat() : ' + p.reloadLogcat + 'ms\n';
    if (p.loadDebugCard != null) o += 'loadDebugCard(): ' + p.loadDebugCard + 'ms\n';
    if (global.performance && global.performance.timing) { var t = global.performance.timing, dr = t.domContentLoadedEventEnd - t.navigationStart; if (dr > 0) o += 'domReady       : ' + dr + 'ms\n'; }
    if (global._mtapiAttachStart != null) o += 'attach()       : ' + Math.round((global.performance.now ? global.performance.now() : Date.now()) - global._mtapiAttachStart) + 'ms\n';
    o += 'jslogCount     : ' + global._jslogBuf.length + '\n';
    if (global._mtapiCustomPerf) Object.keys(global._mtapiCustomPerf).forEach(function(k){ o += k + ' : ' + global._mtapiCustomPerf[k] + 'ms\n'; });
    return o || '(no metrics yet)';
  }
  global._perfRefresh = function(){ var el = global.document && global.document.getElementById('mtapi-debug-perf'); if (el) el.textContent = renderPerf(); };

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
  global._evalClear = function(){
    var out = global.document && global.document.getElementById('mtapi-debug-eval-out');
    if (out) out.innerHTML = '\u2014';
    var inp = global.document && global.document.querySelector('.mtapi-dbg-eval-input');
    if (inp) inp.value = '';
  };

  global._evalConsole = function(){
    var inp = global.document.querySelector('.mtapi-dbg-eval-input'); if(!inp) return;
    var cmd = (inp.value||'').trim(); if(!cmd) return;
    var out;
    try{ var _evalFn = global['eval']; var r = _evalFn(cmd); out = _renderEvalOutput(r); }
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
    try { var old = el.style.outline; el.style.outline = '2px solid #f0f'; setTimeout(function(){ try { el.style.outline = old; } catch(x){} }, 1500); } catch(x) {}
    var info = global.document.getElementById('mtapi-debug-dom-info'); if (!info) return;
    var parts = [];
    parts.push('<b>Selector:</b> ' + esc(getCssSelector(el)));
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
      (function(elem, s){ s.addEventListener('click', function(ev){ if (ev.target === s) { inspectElement(elem); ev.preventDefault(); ev.stopPropagation(); } }); })(el, sum);
      det.appendChild(sum);
      if (el.children && el.children.length > 0) { var childUl = buildDomTree(el, depth + 1); if (childUl) det.appendChild(childUl); }
      li.appendChild(det); ul.appendChild(li);
    }
    return ul;
  }
  global._domRefresh = function(){
    var container = global.document && global.document.getElementById('mtapi-debug-dom-tree'); if (!container) return;
    container.innerHTML = '';
    var root = global.document.documentElement; if (!root) return;
    var doc = global.document;
    var rootDet = doc.createElement('details'); rootDet.open = true;
    var rootSum = doc.createElement('summary');
    rootSum.textContent = 'html'; rootSum.setAttribute('data-tag', 'html');
    rootSum.style.cssText = 'cursor:pointer;padding:1px 2px;user-select:none';
    (function(elem, s){ s.addEventListener('click', function(ev){ if (ev.target === s) { inspectElement(elem); ev.preventDefault(); ev.stopPropagation(); } }); })(root, rootSum);
    rootDet.appendChild(rootSum);
    var tree = buildDomTree(root, 0); if (tree) rootDet.appendChild(tree);
    container.appendChild(rootDet);
  };
  var _domInspectActive = false;
  function _domClickHandler(ev){ if (!_domInspectActive) return; ev.preventDefault(); ev.stopPropagation(); inspectElement(ev.target); }
  global._domInspect = function(){
    _domInspectActive = !_domInspectActive;
    var ind = global.document && global.document.getElementById('mtapi-debug-dom-inspect-ind');
    if (_domInspectActive) { global.document.addEventListener('click', _domClickHandler, true); if (ind) ind.textContent = '\u25C9 ON (tap page)'; }
    else { global.document.removeEventListener('click', _domClickHandler, true); if (ind) ind.textContent = '\u25CB off'; }
  };

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
  var _tabs = ['logs', 'errors', 'logcat', 'devtools', 'system', 'network', 'dom'];
  var _tabLabels = {logs:'Logs', errors:'Errors', logcat:'Logcat', devtools:'DevTools', system:'System', network:'Network', dom:'DOM'};

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
  global._debugOpen = function(){ var ov = global.document && global.document.getElementById('mtapi-debug-overlay'); if (!ov) return; ov.removeAttribute('hidden'); global._setTab(_activeTab); };
  global._debugClose = function(){ var ov = global.document && global.document.getElementById('mtapi-debug-overlay'); if (ov) ov.setAttribute('hidden', ''); global._sidePanelClose(); };

  var CSS = [
    '.mtapi-debug-fab-inline{width:28px;height:28px;border-radius:50%;border:1px solid var(--border,#444);background:var(--bg3,#2a2a2a);color:var(--accent,#f0f);font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;line-height:1;font-family:inherit;margin:0;box-shadow:none}',
    '.mtapi-debug-fab-inline:hover{background:var(--bg4,#3a3a3a)}',
    '.mtapi-debug-back{font-weight:bold;letter-spacing:1px}',
    /* Force scroll everywhere */
    '.mtapi-debug-pre, #mtapi-debug-jslog, #mtapi-debug-logcat, #mtapi-debug-errors, #mtapi-debug-eval-out, #mtapi-debug-devtools-json, #mtapi-debug-network, #mtapi-debug-dom-tree, #mtapi-debug-dom-info, #mtapi-debug-system-info, #mtapi-debug-perf{overflow-y:scroll !important;overflow-x:scroll !important}',
    '.mtapi-debug-pre::-webkit-scrollbar, #mtapi-debug-jslog::-webkit-scrollbar, #mtapi-debug-logcat::-webkit-scrollbar, #mtapi-debug-errors::-webkit-scrollbar, #mtapi-debug-eval-out::-webkit-scrollbar, #mtapi-debug-devtools-json::-webkit-scrollbar, #mtapi-debug-network::-webkit-scrollbar, #mtapi-debug-dom-tree::-webkit-scrollbar, #mtapi-debug-dom-info::-webkit-scrollbar, #mtapi-debug-system-info::-webkit-scrollbar, #mtapi-debug-perf::-webkit-scrollbar{width:12px;height:12px}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb, #mtapi-debug-jslog::-webkit-scrollbar-thumb, #mtapi-debug-logcat::-webkit-scrollbar-thumb, #mtapi-debug-errors::-webkit-scrollbar-thumb, #mtapi-debug-eval-out::-webkit-scrollbar-thumb, #mtapi-debug-devtools-json::-webkit-scrollbar-thumb, #mtapi-debug-network::-webkit-scrollbar-thumb, #mtapi-debug-dom-tree::-webkit-scrollbar-thumb, #mtapi-debug-dom-info::-webkit-scrollbar-thumb, #mtapi-debug-system-info::-webkit-scrollbar-thumb, #mtapi-debug-perf::-webkit-scrollbar-thumb{background:#666;border-radius:6px}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb:hover, #mtapi-debug-jslog::-webkit-scrollbar-thumb:hover, #mtapi-debug-logcat::-webkit-scrollbar-thumb:hover{background:#888}',
    '.logcat-line{display:block;white-space:pre-wrap;word-break:break-all;padding:1px 4px;border-radius:2px}',
    '.logcat-line.lvl-v{color:#818cf8}',
    '.logcat-lvl{display:flex;gap:2px;margin-right:4px;align-items:center}',
    '.logcat-lvl label{cursor:pointer}',
    '.logcat-lvl input{display:none}',
    '.logcat-lvl span{display:inline-block;width:20px;height:20px;line-height:18px;text-align:center;border-radius:3px;font-family:monospace;font-size:10px;font-weight:600;border:1px solid #444;background:#1a1a1a;color:#555;user-select:none}',
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
    'button.copy{background:#3a3a3a;color:#ddd;border:1px solid #555;border-radius:3px;padding:2px 8px;font-family:monospace;font-size:11px;cursor:pointer}',
    'button.copy:hover{background:#4a4a4a}',
    'button.clear{background:#4a2020;color:#f88;border:1px solid #733;border-radius:3px;padding:2px 8px;font-family:monospace;font-size:11px;cursor:pointer}',
    'button.clear:hover{background:#6a2020}',
    '.proc-search,.tbl-search{flex:1;min-width:80px;padding:3px 6px;background:#000;color:#ddd;border:1px solid #444;border-radius:3px;font-family:monospace;font-size:11px}',
    '.proc-search:focus,.tbl-search:focus{outline:1px solid #4fc3f7;border-color:#4fc3f7}',
    '.tbl-toolbar{display:flex;gap:4px;align-items:center;margin:4px 0}',
    '.mtapi-debug-fab{position:fixed;top:8px;right:8px;z-index:999999;width:32px;height:32px;border-radius:50%;border:1px solid #444;background:#2a2a2a;color:#f0f;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);padding:0;line-height:1;font-family:monospace}',
    '.mtapi-debug-fab:hover{background:#3a3a3a}',
    '.mtapi-debug-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999998;background:#1a1a1a;color:#ddd;font-family:monospace;font-size:12px;display:flex;flex-direction:column}',
    '.mtapi-debug-overlay[hidden]{display:none}',
    '.mtapi-debug-topbar{display:flex;align-items:center;padding:4px 8px;background:#222;border-bottom:1px solid #444;gap:8px;flex-shrink:0}',
    '.mtapi-debug-topbar button{background:transparent;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 8px;font-family:monospace;font-size:12px;cursor:pointer}',
    '.mtapi-debug-topbar button:hover{background:#333}',
    '.mtapi-debug-topbar-row1{padding:6px 8px;border-bottom:1px solid #333}',
    '.mtapi-debug-topbar-row2{padding:4px 8px;border-bottom:1px solid #444;overflow-x:auto;flex-shrink:0}',
    '.mtapi-debug-tabs{display:flex;gap:2px;flex:1;overflow-x:auto;min-width:0}',
    '.mtapi-debug-tabs button.active{background:#444;border-color:#666}',
    '.mtapi-debug-content{flex:1;overflow:auto;padding:8px;position:relative;display:flex;flex-direction:column;min-height:0}',
    '.mtapi-debug-content > [data-tab-content]{display:none}',
    '.mtapi-debug-content > [data-tab-content].active{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px}',
    '.mtapi-debug-sidepanel{position:absolute;top:0;right:0;bottom:0;width:200px;background:#222;border-left:1px solid #444;padding:8px;transform:translateX(100%);transition:transform 0.2s;box-shadow:-2px 0 6px rgba(0,0,0,0.4)}',
    '.mtapi-debug-sidepanel.open{transform:translateX(0)}',
    '.mtapi-debug-sidepanel h3{margin:0 0 8px 0;font-size:12px;color:#888;font-weight:normal}',
    '.mtapi-debug-sidepanel ul{list-style:none;padding:0;margin:8px 0 0 0}',
    '.mtapi-debug-sidepanel li{padding:6px 8px;cursor:pointer;border-radius:3px;font-size:12px}',
    '.mtapi-debug-sidepanel li:hover{background:#333}',
    '.mtapi-debug-sidepanel li.active{background:#444}',
    '.mtapi-debug-section{border:1px solid #333;border-radius:3px;margin:0;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden}',
    '.mtapi-debug-section[open]{flex:1 1 auto;min-height:200px;resize:vertical}',
    '.mtapi-debug-section:not([open]){flex:0 0 auto;min-height:0;resize:none}',
    '.mtapi-debug-section > summary{flex-shrink:0}',
    '.mtapi-debug-section > .mtapi-debug-pre,.mtapi-debug-section > div[id$="-network"],.mtapi-debug-section > .mtapi-debug-dom-split{flex:1 1 auto;min-height:0}',
    '.mtapi-debug-section > .mtapi-debug-toolbar{flex-shrink:0}',
    '.mtapi-debug-dom-split{flex:1 1 auto;min-height:200px}',
    '.mtapi-debug-section > summary{padding:4px 8px;background:#222;cursor:pointer;border-bottom:1px solid #333;font-size:11px}',
    '.mtapi-debug-pre{flex:1 1 auto;min-height:80px;max-height:none;overflow:auto;background:#000;color:#0f0;padding:4px;margin:0;font-size:11px;white-space:normal}',
    '#mtapi-debug-jslog{flex:1 1 0;min-height:60px;max-height:none;overflow-y:scroll !important;overflow-x:scroll !important;resize:vertical;background:#000;padding:4px;border:1px solid #333}',
    '#mtapi-debug-jslog::-webkit-scrollbar{width:10px;height:10px}',
    '#mtapi-debug-jslog::-webkit-scrollbar-track{background:#111}',
    '#mtapi-debug-jslog::-webkit-scrollbar-thumb{background:#555;border-radius:5px}',
    'pre.mtapi-debug-pre,.mtapi-debug-pre > pre{white-space:pre-wrap}',
    '.mtapi-debug-pre > table{min-width:max-content}',
    '.mtapi-debug-pre::-webkit-scrollbar{width:10px;height:10px}',
    '.mtapi-debug-pre::-webkit-scrollbar-track{background:#111}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb{background:#555;border-radius:5px}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb:hover{background:#777}',
    '.mtapi-debug-pre::-webkit-scrollbar{width:8px;height:8px}',
    '.mtapi-debug-pre::-webkit-scrollbar-track{background:#111}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb{background:#444;border-radius:4px}',
    '.mtapi-debug-pre::-webkit-scrollbar-thumb:hover{background:#666}',
    '#mtapi-debug-network{min-height:200px;max-height:600px;overflow:auto;resize:vertical;background:#0d0d0d;padding:4px;border:1px solid #333}',
    '#mtapi-debug-network::-webkit-scrollbar{width:10px;height:10px}',
    '#mtapi-debug-network::-webkit-scrollbar-track{background:#111}',
    '#mtapi-debug-network::-webkit-scrollbar-thumb{background:#444;border-radius:5px}',
    '#mtapi-debug-network::-webkit-scrollbar-thumb:hover{background:#666}',
    '#mtapi-debug-network thead th{position:sticky;top:0;background:#222;z-index:1}',
    '#mtapi-debug-network table{min-width:100%}',
    '.net-body-cell{padding:0!important}',
    '.net-body-json{max-height:400px;min-height:80px;overflow:auto;resize:vertical;background:#0d0d0d;padding:4px;border:1px solid #333;font-size:10px;margin:2px 0}',
    '.net-body-json::-webkit-scrollbar{width:8px;height:8px}',
    '.net-body-json::-webkit-scrollbar-track{background:#111}',
    '.net-body-json::-webkit-scrollbar-thumb{background:#444;border-radius:4px}',
    '.net-body-json table{width:100%;border-collapse:collapse;margin:2px 0}',
    '.net-body-json th,.net-body-json td{border:1px solid #333;padding:2px 4px;font-size:10px;vertical-align:top}',
    '.net-body-json th{background:#222;color:#888;font-weight:normal;text-align:left}',
    '.net-body-json details.sub{border:1px solid #444;border-radius:3px;padding:2px;margin:2px 0}',
    '.net-body-json details.sub > summary{padding:2px;cursor:pointer;color:#4fc3f7;font-size:10px}',
    '.net-body-pre{max-height:300px;overflow:auto;background:#000;color:#aaa;padding:2px;margin:0;font-size:9px;white-space:pre-wrap;resize:vertical}',
    'div.mtapi-debug-pre{overflow:auto;resize:vertical;white-space:normal}',
    '.mtapi-debug-table{width:100%;border-collapse:collapse;font-family:monospace;font-size:11px;background:#000}',
    '.mtapi-debug-table th{position:sticky;top:0;background:#222;color:#888;text-align:left;padding:2px 4px;font-weight:normal;z-index:1;border-bottom:1px solid #444}',
    '.mtapi-debug-table td{padding:1px 4px;border-bottom:1px solid #1a1a1a;vertical-align:top}',
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
    'button.icon-btn-sm{background:#2a2a2a;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 6px;font-family:monospace;font-size:13px;cursor:pointer;line-height:1;min-width:26px;height:24px}',
    'button.icon-btn-sm:hover{background:#3a3a3a}',
    'button.icon-btn-sm.danger{color:#f88}',
    'button.icon-btn-sm.accent{color:#4fc3f7}',
    '.mtapi-debug-toolbar{display:flex;gap:4px;align-items:center;margin:4px 0;flex-wrap:wrap}',
    '.mtapi-debug-toolbar input{flex:1;min-width:80px}',
    '.mtapi-debug-dom-split{display:flex;gap:8px;min-height:400px}',
    '.mtapi-debug-dom-tree-wrap{flex:1;overflow:auto;background:#000;padding:4px;border:1px solid #333}',
    '.mtapi-debug-dom-info-wrap{width:280px;overflow:auto;background:#0d0d0d;padding:4px;border:1px solid #333;font-size:11px}'
  ].join('\n');

  function buildTabContents(){
    var p1 = '';
    for(var i=global._jslogBuf.length-1;i>=0;i--){ var e=global._jslogBuf[i]; p1 += esc(fmtTime(e.t)+' ['+(e.lvl||'log')+'] '+e.m)+'\n'; }
    var p3 = '';
    try{ var er=JSON.parse(global.localStorage.getItem('mtapi-errors')||'[]'); p3=er.map(function(x){return fmtTime(x.t)+' ['+x.lvl+'] '+x.m;}).join('\n'); }catch(x){}
    var html = '';

    // Logs tab
    html += '<div data-tab-content="logs" class="' + (_activeTab==='logs'?'active':'') + '">';
    // Console Eval FIRST
    html += '<details class="mtapi-debug-section" open><summary>Console Eval</summary>';
    html += '<div style="margin:4px 0;display:flex;gap:4px;align-items:center"><input class="mtapi-dbg-eval-input" placeholder="JS..." style="flex:1;padding:4px;background:#000;color:#ddd;border:1px solid #444;font-family:monospace"><button class="icon-btn-sm accent" aria-label="Run" title="Run (evaluate)" onclick="window._evalConsole()">\u25B6</button><button class="icon-btn-sm" aria-label="DOM" title="Open DOM tree" onclick="window._setTab(\'dom\')">\uD83C\uDF33</button><button class="icon-btn-sm danger" aria-label="Clear" title="Clear" onclick="window._evalClear&&window._evalClear()">🗑</button></div>';
    html += '<div id="mtapi-debug-eval-out" class="mtapi-debug-pre" style="color:#ddd">\u2014</div></details>';
    // JS Logs SECOND
    html += '<details class="mtapi-debug-section" open data-refresh="jslog"><summary>JS Logs <span id="mtapi-debug-jslog-count">('+global._jslogBuf.length+')</span></summary>';
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
    html += '<div id="mtapi-debug-jslog" class="mtapi-debug-pre">'+(_renderJslogWithQuery ? _renderJslogWithQuery('') : p1)+'</div></details>';
    html += '</div>';

    // Logcat tab
    html += '<div data-tab-content="logcat" class="' + (_activeTab==='logcat'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="logcat"><summary>Logcat</summary>';
    html += '<div class="tbl-toolbar">';
    html += '<div class="logcat-lvl" title="filter by level">';
    html += '<label><input type="checkbox" data-lvl="v" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-v">V</span></label>';
    html += '<label><input type="checkbox" data-lvl="d" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-d">D</span></label>';
    html += '<label><input type="checkbox" data-lvl="i" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-i">I</span></label>';
    html += '<label><input type="checkbox" data-lvl="w" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-w">W</span></label>';
    html += '<label><input type="checkbox" data-lvl="e" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-e">E</span></label>';
    html += '<label><input type="checkbox" data-lvl="f" checked onchange="window._logcatFilter&&window._logcatFilter()"><span class="lvl-f">F</span></label>';
    html += '</div>';
    html += _iconSearch('mtapi-debug-logcat-search', "window._refreshLogcatQuery&&window._refreshLogcatQuery()");
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyLogcat&&window._copyLogcat()");
    html += _iconBtn('\u21bb', 'Refresh', "window._logcatRefresh&&window._logcatRefresh()", 'accent');
    html += '</div>';
    html += '<div id="mtapi-debug-logcat" class="mtapi-debug-pre" style="color:#aaa;font-size:10px">'+(renderLogcat())+'</div></details>';
    html += '</div>';

    // DevTools tab
    html += '<div data-tab-content="devtools" class="' + (_activeTab==='devtools'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="devtools"><summary>WebView DevTools</summary><div style="padding:8px;line-height:1.6">';
    html += '<p><b>On PC (via adb):</b></p><code>adb shell pidof dev.mtapi</code><br><code>adb forward tcp:9222 localabstract:webview_devtools_remote_&lt;PID&gt;</code><br><code>chrome://inspect/#devices</code>';
    html += '<p><b>On device (JSON):</b></p><button class="copy" onclick="window._fetchDevToolsJSON()">\u21bb GET /devtools/json</button>';
    html += '<div id="mtapi-debug-devtools-json" class="mtapi-debug-pre" style="color:#aaa;margin-top:4px">(click button)</div>';
    html += '</div></details></div>';

    // System tab
    html += '<div data-tab-content="system" class="' + (_activeTab==='system'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="perf"><summary>Performance</summary><div style="margin:4px 0"><button class="copy" onclick="window._perfReset()">\uD83D\uDD04 Reset</button></div><pre id="mtapi-debug-perf" class="mtapi-debug-pre" style="color:#ddd">'+esc(renderPerf())+'</pre></details>';
    html += '<details class="mtapi-debug-section" data-refresh="system"><summary>System info</summary><div id="mtapi-debug-system-info" class="mtapi-debug-pre" style="color:#aaa">(loading...)</div></details>';
    html += '</div>';

    // Network tab
    html += '<div data-tab-content="network" class="' + (_activeTab==='network'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="network"><summary>Requests <span id="mtapi-debug-net-count">('+global._netBuf.length+')</span></summary>';
    html += '<div class="mtapi-debug-toolbar">';
    html += _iconSearch('mtapi-debug-network-search', "window._netRefresh&&window._netRefresh()");
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyNetwork&&window._copyNetwork()");
    html += _iconBtn('\uD83D\uDDD1', 'Clear', "window._netClear&&window._netClear()", 'danger');
    html += '</div>';
    html += '<div id="mtapi-debug-network">'+renderNetwork()+'</div></details>';
    html += '</div>';

    // Errors tab
    html += '<div data-tab-content="errors" class="' + (_activeTab==='errors'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open data-refresh="errors"><summary>Errors (persistent)</summary>';
    html += '<div class="mtapi-debug-toolbar">';
    html += _iconSearch('mtapi-debug-errors-search', "window._refreshErrorsQuery&&window._refreshErrorsQuery()");
    html += _iconBtn('\uD83D\uDCCB', 'Copy', "window._copyErrors&&window._copyErrors()");
    html += _iconBtn('\uD83D\uDDD1', 'Clear', "window._errorsClear&&window._errorsClear()", 'danger');
    html += '</div>';
    html += '<div id="mtapi-debug-errors" class="mtapi-debug-pre" style="color:#f66">'+(_renderErrorsWithQuery ? _renderErrorsWithQuery('') : esc(p3))+'</div></details>';
    html += '</div>';

    // DOM tab
    html += '<div data-tab-content="dom" class="' + (_activeTab==='dom'?'active':'') + '">';
    html += '<div style="margin:0 0 4px 0;display:flex;gap:4px;align-items:center"><button class="copy" onclick="window._domRefresh()">\u21bb Refresh</button><button class="copy" onclick="window._domInspect()">\uD83D\uDD0D Inspect</button><span id="mtapi-debug-dom-inspect-ind" style="padding:4px 6px;color:#888">\u25CB off</span></div>';
    html += '<div class="mtapi-debug-dom-split"><div id="mtapi-debug-dom-tree" class="mtapi-debug-dom-tree-wrap">(click Refresh)</div><div id="mtapi-debug-dom-info" class="mtapi-debug-dom-info-wrap">(click element in tree)</div></div>';
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
    backBtn.textContent = 'MTAPI';
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
      global._setTab(_activeTab);
      try { global._jslogLiveStart(2000); } catch(e){}
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
