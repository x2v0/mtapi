🛠 Каких инструментов не хватает для debugging

Что уже есть (8)

Инструмент Покрывает
Logcat Android-логи (сервер, system)
JS Logs console.* + [net]
Console Eval выполнить JS
Performance 3 метрики (snapshot)
Sources прочитать app.js
Elements плоский список id/class
Application localStorage/sessionStorage/caches
Processes только свой процесс

---

🔴 Критические пробелы (найдёт реальные баги)

1. Stack trace для ошибок ⏱ 30 мин

Сейчас:

```
[error] Uncaught: h is not defined at app.js:1345
```

Только 1 строка — где в стеке вызов? Не видно.

Нужно:

```js
window.addEventListener('error', function(ev) {
  push('error', [
    (ev.message || '?') +
    '\n  at ' + (ev.filename || '?') + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0) +
    (ev.error && ev.error.stack ? '\n' + ev.error.stack : '')
  ]);
});
```

Результат:

```
[error] Uncaught: h is not defined
  at app.js:1345:5
  ReferenceError: h is not defined
    at loadDebugCard (app.js:1345)
    at onload (app.js:1290)
```

Плюс для _evalConsole:

```js
} catch(e) {
  out = 'Error: ' + e.message + (e.stack ? '\n' + e.stack : '');
}
```

---

2. Hot reload app.js ⏱ 2 часа

Сейчас: патч → make apk (30с) → make install (10с) → force-stop → open (5с) = ~1 мин за итерацию.

Нужно: сервер отдаёт app.js с диска в dev-режиме:

```go
// в http.go
if os.Getenv("MTAPI_DEV") == "1" {
    http.ServeFile(w, r, "gocore/cmd/mtapi-server/app.js")
} else {
    fmt.Fprint(w, appJS)  // embedded
}
```

+ в index.html: Cache-Control: no-store для app.js.

Workflow:

```
1. патч app.js (редактор)
2. reload WebView (Ctrl+R / кнопка / pull-to-refresh)
3. изменения видны — БЕЗ rebuild
```

Экономия: 1 мин → 2 сек за итерацию. Самое большое ускорение из всего списка.

---

3. Network body capture ⏱ 1 час

Сейчас: [net] ← 200 GET /battery (56ms, 53b, application/json) — только размер, не содержимое.

Нужно: логировать body для запросов с ошибками + on-demand:

```js
// в fetch wrapper
if (!r.ok || window._netVerbose) {
  r.clone().text().then(function(body) {
    console.log('[net] body: ' + body.slice(0, 500));
  });
}
```

Toggle в JS Logs toolbar 📦 — включить body capture.

Результат:

```
[net] ← 500 GET /battery (56ms, 53b, application/json)
[net] body: {"ok":false,"error":"permission denied"}
```

Что чинит: "сервер вернул не то" без открытия curl/DevTools.

---

4. Persistent error log ⏱ 30 мин

Сейчас: JS Logs теряются при reload. Если ошибка была — не видно после перезагрузки.

Нужно: ошибки (Error + Uncaught) сохранять в localStorage:

```js
function push(level, args) {
  // ... существующий код ...
  if (level === 'error') {
    try {
      var errors = JSON.parse(localStorage.getItem('mtapi-errors') || '[]');
      errors.unshift({ t: Date.now(), m: msg });
      if (errors.length > 50) errors.length = 50;
      localStorage.setItem('mtapi-errors', JSON.stringify(errors));
    } catch(e) {}
  }
}
```

+ секция в /debug: Errors (persistent) — последние 50 ошибок, выживают reload.

Что чинит: "упало при старте" → reload → ошибка потеряна → теперь нет.

---

5. Element inspect ⏱ 1 час

Сейчас: _inspectDom() — плоский список, только id/class.

Нужно: клик по элементу → detail:

```js
window._inspectElement = function(selector) {
  var el = document.querySelector(selector);
  if (!el) return '(not found)';
  var cs = getComputedStyle(el);
  return {
    tag: el.tagName,
    id: el.id,
    class: el.className,
    rect: el.getBoundingClientRect(),
    display: cs.display,
    visibility: cs.visibility,
    color: cs.color,
    fontSize: cs.fontSize,
    listeners: 'n/a (need wrap)',  // см. п.6
    parent: el.parentElement?.tagName,
    children: el.children.length,
  };
};
```

Console Eval: _inspectElement('.ep[data-path="/battery"]') → объект в output.

+ CSS border overlay: _highlightElement('.sel') → outline: 2px solid red на 3с (визуально найти элемент).

---

🟡 Средний приоритет

6. Event listener tracker ⏱ 1 час

Сейчас: не видно, какие handlers привязаны к #logcat-search. Если "не работает" — не знаем почему.

Нужно: обернуть addEventListener при старте:

```js
(function() {
  var orig = EventTarget.prototype.addEventListener;
  window._listeners = {};
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    var key = (this.id || this.className || this.tagName || '?') + ':' + type;
    window._listeners[key] = (window._listeners[key] || 0) + 1;
    return orig.call(this, type, fn, opts);
  };
})();
```

Console Eval: window._listeners → {"logcat-search:input": 2, "jslog-search:input": 2, ...}

Что чинит: "клик не работает" → проверить, есть ли handler. "Работает дважды" → count 2.

---

7. HTTP request replay ⏱ 30 мин

Сейчас: чтобы повторить GET /battery — открыть endpoint вручную.

Нужно: клик по [net] → GET /battery → refetch:

```js
// в _copyJslog / JS Logs - сделать span кликабельным
span.title = 'Click to replay';
span.onclick = function() { _fetch(urlStr); };
```

Что чинит: "endpoint иногда падает" — повторить 10 раз вручную, увидеть паттерн.

---

8. Cookie viewer ⏱ 15 мин

Сейчас: document.cookie не видно нигде.

Нужно: в Application:

```js
lines.push('═══ cookies (' + (document.cookie.split(';').filter(Boolean).length) + ') ═══');
document.cookie.split(';').forEach(function(c) { lines.push(' ' + c.trim()); });
```

Что чинит: "сессия слетает" — проверить TOKEN в cookie.

---

9. Native bridge spy ⏱ 30 мин

Сейчас: Android.processList() / Android.restartApp() — вызовы не логируются.

Нужно: обернуть Android.*:

```js
if (typeof Android !== 'undefined') {
  var _origAndroid = Android;
  Android = new Proxy(_origAndroid, {
    get: function(t, k) {
      var v = t[k];
      if (typeof v === 'function') {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          console.log('[native] Android.' + k + '(' + JSON.stringify(args) + ')');
          try { return v.apply(t, args); }
          catch(e) { console.log('[native] Android.' + k + ' ERR: ' + e.message); throw e; }
        };
      }
      return v;
    }
  });
}
```

Что чинит: "processList пустой" → видно, вызывается ли метод и с какими args.

---

10. WebSocket log capture ⏱ 1 час

Сейчас: /devtools/json — это HTTP, но сам WS-канал (WebView debugging) не виден в JS Logs.

Нужно: обернуть WebSocket:

```js
var _OrigWS = window.WebSocket;
window.WebSocket = function(url, protocols) {
  console.log('[ws] → ' + url);
  var ws = new _OrigWS(url, protocols);
  var _send = ws.send.bind(ws);
  ws.send = function(data) {
    console.log('[ws] → ' + String(data).slice(0, 100));
    return _send(data);
  };
  ws.addEventListener('message', function(ev) {
    console.log('[ws] ← ' + String(ev.data).slice(0, 100));
  });
  return ws;
};
```

---

🟢 Nice-to-have

# Инструмент Что даёт
11 MutationObserver какие DOM-изменения — "UI мерцает"
12 Timeline graph для _perf sparkline render() за N вызовов
13 PerformanceObserver longtask > 50ms — где тормозит
14 DOM tree (<details> на узел) кликабельное дерево вместо плоского
15 CSS search по style.css "где определён .logcat-line"
16 Error banner красный overlay вверху при ошибке
17 debugger; breakpoints работает, если ПК DevTools подключён — не для mobile
18 Log sessions _jslogMark('start') → группировка
19 Memory counter performance.memory — heap usage
20 Screenshot Android.screenshot() визуальный баг → PNG
21 Request filter by status "показать только 500"
22 Diff двух ответов "battery было 94, стало 94" — регрессия
23 Eval history (up-arrow) не набирать заново _jslogBuf.length
24 Conditional log _logIf(cond, msg)

---

📊 Приоритеты (ROI = польза / усилие)

# Инструмент Усилие Польза ROI
1 Stack trace 30м 🔥🔥🔥 ⭐⭐⭐⭐⭐
2 Hot reload app.js 2ч 🔥🔥🔥 ⭐⭐⭐⭐⭐
3 Persistent errors 30м 🔥🔥 ⭐⭐⭐⭐⭐
4 Network body 1ч 🔥🔥🔥 ⭐⭐⭐⭐
5 Element inspect 1ч 🔥🔥 ⭐⭐⭐⭐
6 Event listeners 1ч 🔥🔥 ⭐⭐⭐
7 HTTP replay 30м 🔥 ⭐⭐⭐
8 Cookies 15м 🔥 ⭐⭐⭐
9 Native spy 30м 🔥🔥 ⭐⭐⭐
10 WS capture 1ч 🔥 ⭐⭐

---

🎯 Рекомендация: v2.0 (топ-3, ~3 часа)

Сделать одним патчем:

A. Stack trace (30м) — критично для отладки ошибок

B. Persistent errors (30м) — "что упало при старте"

C. Hot reload (2ч) — экономит ~1 час в день

Вместе: патч → reload (2с) вместо make apk (60с). Ошибки с полным стеком выживают reload.

---

🚀 Пример: как изменится workflow

Сейчас (60с цикл)

```
1. заметил баг
2. Console Eval → найти причину (30с)
3. патч app.js (вне приложения — нужен adb/ssh)
4. make apk (30с) + make install (10с)
5. force-stop + open (5с)
6. проверить
7. повтор
```

С hot reload (10с цикл)

```
1. заметил баг
2. Console Eval → найти причину (30с)
3. патч app.js (в ssh/редакторе)
4. reload WebView (pull-to-refresh / Ctrl+R / кнопка)
5. изменения видны
6. повтор
```

Проверка ошибки: вместо "не вижу, что упало после reload" → Errors (persistent) — последние 50 ошибок в /debug.

---

🟢 Хочу реализовать (что именно?)

Скажите, что делать сейчас:

Вариант Патч
Топ-3 (v2.0) stack trace + persistent errors + hot reload
Только stack trace быстрый патч (30м, ~50 строк)
Только hot reload нужен Go-патч в http.go + dev-flag
Network body + replay 1.5ч, 3 патча
Всё по списку 6ч, 5-6 тегов (v2.0–v2.5)
Точечно по запросу скажите, что нужнее

Мой совет: начните с stack trace + persistent errors (1 час, огромный профит), потом hot reload (2 часа, экономит дни).

Что делаем? 🎯
