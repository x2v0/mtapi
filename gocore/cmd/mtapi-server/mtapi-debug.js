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
          if (global._netVerbose === true) {
            try { r.clone().text().then(function(b){ entry.body = b.length > 1024 ? b.slice(0, 1024) + '\n... (' + (b.length - 1024) + ' more)' : b; _netPush(entry); }).catch(function(){ _netPush(entry); }); }
            catch(e) { _netPush(entry); }
          } else { _netPush(entry); }
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
  global._evalConsole = function(){
    var inp = global.document.querySelector('.mtapi-dbg-eval-input'); if(!inp) return;
    var cmd = (inp.value||'').trim(); if(!cmd) return;
    var out;
    try{ var _evalFn = global['eval']; var r = _evalFn(cmd); out = (r===undefined)?'undefined':(r===null)?'null':(typeof r==='object')?JSON.stringify(r,null,2):String(r); }
    catch(e){ out='Error: '+e.message+(e.stack?'\n'+e.stack:''); push('error',[cmd+' \u2192 '+out]); }
    var pre = global.document.getElementById('mtapi-debug-eval-out'); if(pre) pre.textContent=out;
  };

  // ─── logcat ───────────────────────────────────────────────
  function renderLogcat(){
    if (!global.AndroidLogcat || !global.AndroidLogcat.getLogcat) return '(logcat not available — AndroidLogcat not injected)';
    try { var log = global.AndroidLogcat.getLogcat(100); return String(log).split('\n').slice().reverse().join('\n'); }
    catch(e) { return '(logcat error: ' + e.message + ')'; }
  }
  global._logcatRefresh = function(){ var pre = global.document.getElementById('mtapi-debug-logcat'); if (pre) pre.textContent = renderLogcat(); };

  // ─── network table ────────────────────────────────────────
  function renderNetwork(){
    var buf = global._netBuf || [];
    if (!buf.length) return '<div style="color:#666;padding:4px">(no requests captured)</div>';
    var o = '<table style="width:100%;border-collapse:collapse;font-size:10px">';
    o += '<thead><tr style="background:#222"><th>Time</th><th>Method</th><th>URL</th><th>Status</th><th>Size</th><th>CT</th><th>ms</th></tr></thead><tbody>';
    for (var i = buf.length - 1; i >= 0; i--) {
      var e = buf[i];
      o += '<tr style="border-top:1px solid #333"><td>' + esc(fmtTime(e.t)) + '</td><td>' + esc(e.method) + '</td><td title="' + esc(e.url) + '">' + esc(e.url.length > 60 ? e.url.slice(0, 60) + '...' : e.url) + '</td><td>' + esc(String(e.status)) + '</td><td>' + esc(String(e.size)) + '</td><td>' + esc(String(e.ct)) + '</td><td>' + esc(String(e.ms)) + '</td></tr>';
      if (e.body) o += '<tr><td colspan="7"><pre style="max-height:120px;overflow:auto;background:#000;color:#aaa;padding:2px;margin:0;font-size:9px;white-space:pre-wrap">' + esc(e.body) + '</pre></td></tr>';
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
    var parts = [];
    try { if (global.performance && global.performance.timing) parts.push('Uptime (page): ' + Math.round((Date.now() - global.performance.timing.navigationStart) / 1000) + 's'); else parts.push('Uptime (page): n/a'); } catch(e) { parts.push('Uptime: ' + e.message); }
    parts.push('Port: 7788 (default)');
    try { if (global.performance && global.performance.memory) parts.push('JS Heap: ' + Math.round(global.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB / ' + Math.round(global.performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'); else parts.push('JS Heap: n/a'); } catch(e) { parts.push('Memory: ' + e.message); }
    try { if (global.Android && typeof global.Android.processList === 'function') { parts.push('---'); parts.push(global.Android.processList()); } else parts.push('Processes: n/a (Android bridge not available)'); } catch(e) { parts.push('Processes: ' + e.message); }
    el.textContent = parts.join('\n');
  }
  global._fetchDevToolsJSON = function(){
    var pre = global.document && global.document.getElementById('mtapi-debug-devtools-json'); if (!pre) return;
    pre.textContent = '(loading...)';
    var token = ''; try { var m = global.location.search.match(/[?&]token=([^&]+)/); if (m) token = m[1]; } catch(e) {}
    var url = '/devtools/json' + (token ? '?token=' + encodeURIComponent(token) : '');
    var f = global.fetch; if (!f) { pre.textContent = '(no fetch)'; return; }
    f(url).then(function(r){ return r.json(); }).then(function(j){ pre.textContent = JSON.stringify(j, null, 2); }).catch(function(e){ pre.textContent = '(error: ' + e.message + ')'; });
  };

  // ─── chrome (FAB + overlay + tabs + side panel) ───────────
  var _activeTab = 'logs';
  var _tabs = ['logs', 'logcat', 'devtools', 'system', 'dom'];
  var _tabLabels = {logs:'Logs', logcat:'Logcat', devtools:'DevTools', system:'System', dom:'DOM'};

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
    '.mtapi-debug-fab{position:fixed;top:8px;right:8px;z-index:999999;width:32px;height:32px;border-radius:50%;border:1px solid #444;background:#2a2a2a;color:#f0f;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);padding:0;line-height:1;font-family:monospace}',
    '.mtapi-debug-fab:hover{background:#3a3a3a}',
    '.mtapi-debug-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999998;background:#1a1a1a;color:#ddd;font-family:monospace;font-size:12px;display:flex;flex-direction:column}',
    '.mtapi-debug-overlay[hidden]{display:none}',
    '.mtapi-debug-topbar{display:flex;align-items:center;padding:4px 8px;background:#222;border-bottom:1px solid #444;gap:8px;flex-shrink:0}',
    '.mtapi-debug-topbar button{background:transparent;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 8px;font-family:monospace;font-size:12px;cursor:pointer}',
    '.mtapi-debug-topbar button:hover{background:#333}',
    '.mtapi-debug-tabs{display:flex;gap:2px;flex:1;overflow-x:auto;min-width:0}',
    '.mtapi-debug-tabs button.active{background:#444;border-color:#666}',
    '.mtapi-debug-content{flex:1;overflow:auto;padding:8px;position:relative}',
    '.mtapi-debug-content > [data-tab-content]{display:none}',
    '.mtapi-debug-content > [data-tab-content].active{display:block}',
    '.mtapi-debug-sidepanel{position:absolute;top:0;right:0;bottom:0;width:200px;background:#222;border-left:1px solid #444;padding:8px;transform:translateX(100%);transition:transform 0.2s;box-shadow:-2px 0 6px rgba(0,0,0,0.4)}',
    '.mtapi-debug-sidepanel.open{transform:translateX(0)}',
    '.mtapi-debug-sidepanel h3{margin:0 0 8px 0;font-size:12px;color:#888;font-weight:normal}',
    '.mtapi-debug-sidepanel ul{list-style:none;padding:0;margin:8px 0 0 0}',
    '.mtapi-debug-sidepanel li{padding:6px 8px;cursor:pointer;border-radius:3px;font-size:12px}',
    '.mtapi-debug-sidepanel li:hover{background:#333}',
    '.mtapi-debug-sidepanel li.active{background:#444}',
    '.mtapi-debug-section{border:1px solid #333;border-radius:3px;margin:4px 0;background:#0d0d0d}',
    '.mtapi-debug-section > summary{padding:4px 8px;background:#222;cursor:pointer;border-bottom:1px solid #333;font-size:11px}',
    '.mtapi-debug-pre{max-height:300px;overflow:auto;background:#000;color:#0f0;padding:4px;margin:0;white-space:pre-wrap;font-size:11px}',
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

    html += '<div data-tab-content="logs" class="' + (_activeTab==='logs'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open><summary>JS Logs <span id="mtapi-debug-jslog-count">('+global._jslogBuf.length+')</span></summary>';
    html += '<div style="margin:4px 0"><button onclick="window._jslogBuf=[];document.getElementById(\'mtapi-debug-jslog\').innerHTML=\'\';document.getElementById(\'mtapi-debug-jslog-count\').textContent=\'(0)\'">Clear</button></div>';
    html += '<pre id="mtapi-debug-jslog" class="mtapi-debug-pre">'+p1+'</pre></details>';
    html += '<details class="mtapi-debug-section"><summary>Console Eval</summary>';
    html += '<div style="margin:4px 0;display:flex;gap:4px;align-items:center"><input class="mtapi-dbg-eval-input" placeholder="JS..." style="flex:1;padding:4px;background:#000;color:#ddd;border:1px solid #444;font-family:monospace"><button onclick="window._evalConsole()">\u25B6 Run</button><button onclick="window._setTab(\'dom\')" title="Open DOM tree">\uD83C\uDF33 DOM</button></div>';
    html += '<pre id="mtapi-debug-eval-out" class="mtapi-debug-pre" style="color:#ddd">\u2014</pre></details>';
    html += '<details class="mtapi-debug-section"><summary>Errors (persistent)</summary>';
    html += '<div style="margin:4px 0"><button onclick="localStorage.removeItem(\'mtapi-errors\');document.getElementById(\'mtapi-debug-errors\').textContent=\'\'">Clear</button></div>';
    html += '<pre id="mtapi-debug-errors" class="mtapi-debug-pre" style="color:#f66">'+esc(p3)+'</pre></details>';
    html += '<details class="mtapi-debug-section"><summary>Network <span id="mtapi-debug-net-count">('+global._netBuf.length+')</span></summary>';
    html += '<div style="margin:4px 0"><label style="font-size:10px"><input type="checkbox" id="mtapi-debug-netverbose" '+((global._netVerbose===true)?'checked':'')+' onchange="window._netVerbose=this.checked"> verbose</label> <button onclick="window._netBuf=[];window._netRefresh&&window._netRefresh()">Clear</button></div>';
    html += '<div id="mtapi-debug-network" style="max-height:300px;overflow:auto">'+renderNetwork()+'</div></details>';
    html += '</div>';

    html += '<div data-tab-content="logcat" class="' + (_activeTab==='logcat'?'active':'') + '">';
    html += '<div style="margin:0 0 4px 0"><button onclick="window._logcatRefresh()">\u21bb Refresh</button></div>';
    html += '<pre id="mtapi-debug-logcat" class="mtapi-debug-pre" style="color:#aaa;font-size:10px">'+esc(renderLogcat())+'</pre>';
    html += '</div>';

    html += '<div data-tab-content="devtools" class="' + (_activeTab==='devtools'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open><summary>WebView DevTools</summary><div style="padding:8px;line-height:1.6">';
    html += '<p><b>On PC (via adb):</b></p><code>adb shell pidof dev.mtapi</code><br><code>adb forward tcp:9222 localabstract:webview_devtools_remote_&lt;PID&gt;</code><br><code>chrome://inspect/#devices</code>';
    html += '<p><b>On device (JSON):</b></p><button onclick="window._fetchDevToolsJSON()">\u21bb GET /devtools/json</button>';
    html += '<pre id="mtapi-debug-devtools-json" class="mtapi-debug-pre" style="color:#aaa;margin-top:4px">(click button)</pre>';
    html += '</div></details></div>';

    html += '<div data-tab-content="system" class="' + (_activeTab==='system'?'active':'') + '">';
    html += '<details class="mtapi-debug-section" open><summary>Performance</summary><div style="margin:4px 0"><button onclick="window._perfReset()">\uD83D\uDD04 Reset</button></div><pre id="mtapi-debug-perf" class="mtapi-debug-pre" style="color:#ddd">'+esc(renderPerf())+'</pre></details>';
    html += '<details class="mtapi-debug-section"><summary>System info</summary><pre id="mtapi-debug-system-info" class="mtapi-debug-pre" style="color:#aaa">(loading...)</pre></details>';
    html += '</div>';

    html += '<div data-tab-content="dom" class="' + (_activeTab==='dom'?'active':'') + '">';
    html += '<div style="margin:0 0 4px 0;display:flex;gap:4px;align-items:center"><button onclick="window._domRefresh()">\u21bb Refresh</button><button onclick="window._domInspect()">\uD83D\uDD0D Inspect</button><span id="mtapi-debug-dom-inspect-ind" style="padding:4px 6px;color:#888">\u25CB off</span></div>';
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

    var tb = doc.createElement('div');
    tb.className = 'mtapi-debug-topbar';

    var backBtn = doc.createElement('button');
    backBtn.id = 'mtapi-debug-back';
    backBtn.textContent = '\u2190';
    backBtn.title = 'Back to app';
    backBtn.setAttribute('onclick', 'window._debugClose()');
    tb.appendChild(backBtn);

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
    tb.appendChild(tabsDiv);

    var menuBtn = doc.createElement('button');
    menuBtn.id = 'mtapi-debug-menu';
    menuBtn.textContent = '\uD83D\uDC1E';
    menuBtn.title = 'Tabs menu';
    menuBtn.setAttribute('onclick', 'window._sidePanelToggle()');
    tb.appendChild(menuBtn);

    ov.appendChild(tb);

    var content = doc.createElement('div');
    content.className = 'mtapi-debug-content';
    content.innerHTML = buildTabContents();
    ov.appendChild(content);

    var sp = doc.createElement('div');
    sp.id = 'mtapi-debug-sidepanel';
    sp.className = 'mtapi-debug-sidepanel';
    var spHtml = '<h3>Tabs</h3><ul>';
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
    host.appendChild(fab);
    host.appendChild(ov);

    return ov;
  }

  // ─── public API ───────────────────────────────────────────
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
