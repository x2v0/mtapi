🛠 Как проводить debugging в mtapi (без ПК)

Общий workflow

```
1. ЗАМЕТИТЬ проблему      → что не так (визуально)
2. ЛОКАТЬ                 → Logcat (Android) или JS Logs (app.js)
3. ФИЛЬТРОВАТЬ            → search + уровни
4. ПРОВЕРИТЬ ГИПОТЕЗУ     → Console Eval
5. ПОСМОТРЕТЬ DOM/Storage → Elements / Application
6. ЗАМЕРИТЬ               → Performance
7. ПРОЧИТАТЬ КОД          → Sources
8. ИСПРАВИТЬ              → патч → make apk → install
```

---

📋 Пример 1: Endpoint возвращает "не те" данные

Симптом: GET /battery показывает percentage: null вместо 94.

Шаги

1. Открыть /debug → Logcat (search battery):

```
20:22:43.933 ... I battery: returning 94
```

→ Сервер отдаёт 94 ✅

2. JS Logs (search battery):

```
20:22:43.933 [log] [net] ← 200 GET /battery (56ms, 53b, application/json)
```

→ 53b — подозрительно мало. {"ok":true,"data":{"percentage":94...}} должен быть ~100b+.

3. Console Eval → проверить ответ напрямую:

```js
fetch('/battery?token='+TOKEN).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))
```

▶ Run → в JS Logs:

```
[log] {"ok":true,"data":{"percentage":94,"charging":true}}
```

→ Данные есть.

4. Console Eval → проверить render:

```js
document.querySelector('.ep[data-path="/battery"] .ep-b').innerText
```

→ percentage: 94 — OK, значит баг в отображении (render).

5. Console Eval → проверить, что renderData получает:

```js
JSON.stringify(window._debugData || 'no-data')
```

Где искать

Что Где
Сервер не отдаёт Logcat + curl
Клиент не получает JS Logs [net] ←
Клиент получает, но не рендерит Console Eval _debugData / .innerText
Рендерит, но CSS скрывает Elements (_inspectDom)

---

📋 Пример 2: JS ошибка "ничего не работает"

Симптом: клик по кнопке — ничего. В консоли браузера не видно (WebView).

Шаги

1. /debug → JS Logs (search error):

```
20:25:10.123 [error] Uncaught: foo is not defined at app.js:1234
```

→ catch через window.onerror (уже перехвачено).

2. Console Eval → воспроизвести вручную:

```js
window._logcatLiveTimer
```

→ если undefined → переменная не объявлена.

3. Console Eval → проверить, что функция есть:

```js
typeof window._startLogcatLive
```

→ "function" ✅ / "undefined" ❌

4. Console Eval → вызвать и поймать ошибку:

```js
try { window._startLogcatLive(); 'OK' } catch(e) { 'ERR: ' + e.message }
```

→ ERR: h is not defined — нашли!

5. Sources → 📄 → search _startLogcatLive → увидеть код → понять причину.

Результат

Что Console Eval
Есть ли функция typeof window.fn
Есть ли переменная typeof window._var
Выполнить безопасно try { fn(); 'OK' } catch(e) { 'ERR: '+e.message }
Найти баг в коде Sources → search

---

📋 Пример 3: UI элемент "не работает"

Симптом: кнопка ▶ Run в Console Eval — клик не даёт результата.

Шаги

1. Elements → _inspectDom:

```js
_inspectDom()
```

→ в #dom-pre видно все id/class — можно найти #eval-sub/.eval-input/.eval-output.

2. Console Eval → проверить, что элемент есть:

```js
document.querySelector('.eval-input') !== null
```

→ true / false.

3. Console Eval → проверить, что handler привязан:

```js
document.querySelector('button[onclick*="_evalConsole"]')
```

→ есть ли кнопка в DOM.

4. Console Eval → вызвать функцию напрямую:

```js
document.querySelector('.eval-input').value = '1+1';
window._evalConsole();
document.getElementById('eval-output').textContent
```

→ "2" ✅ / ошибка.

5. Console Eval → проверить CSS:

```js
getComputedStyle(document.getElementById('eval-output')).display
```

→ "none" → CSS скрывает (баг в CSS).

Что покрывает

Проблема Команда
Элемент не в DOM document.querySelector('.sel')
Handler не привязан button.onclick / getAttribute('onclick')
Функция падает try { fn() } catch(e)
CSS скрывает getComputedStyle(el).display

---

📋 Пример 4: Endpoint "медленный"

Симптом: GET /app/list — 2.3с.

Шаги

1. /debug → Performance:

```
render()        : 23ms
reloadLogcat()  : ?     ← таймер отключён
loadDebugCard() : 139ms
```

→ loadDebugCard : 139ms — сам /debug грузится.

2. JS Logs (search app/list):

```
20:25:41.993 [log] [net] ← 200 GET /app/list (2372ms, ?b, application/json)
20:25:39.621 [log] [net] → GET /app/list
```

→ 2372ms — сервер отдаёт медленно.

3. Console Eval → замерить сам fetch:

```js
var t=performance.now(); fetch('/app/list?token='+TOKEN).then(r=>r.json()).then(j=>console.log('server: ' + Math.round(performance.now()-t) + 'ms'))
```

▶ Run → в JS Logs: server: 2350ms → сервер медленный.

4. Console Eval → замерить рендеринг:

```js
var t=performance.now(); document.querySelector('.ep[data-path*="/app/list"] .ep-b').innerHTML = renderData(window._debugData); 'render: ' + Math.round(performance.now()-t) + 'ms'
```

→ render: 22ms → клиент быстрый, баг в сервере (Go).

Диагноз

Замер Значит
[net] ← ... (2372ms) Сервер медленный
Performance loadDebugCard : 139ms /debug медленный (logcat?)
render : 22ms Клиент ок
fetch : 2350ms Подтверждение сервера

Если сервер медленный — смотреть Go-код (/app/list — PackageManager, может быть CPU-bound).

---

📋 Пример 5: Logcat "не обновляется"

Симптом: открыл /debug → Logcat не меняется (0.5+ сек — старое).

Шаги

1. Console Eval → проверить таймер:

```js
window._logcatLiveTimer
```

→ 123 (number) — работает ✅ / undefined — не запущен ❌.

2. Console Eval → принудительно:

```js
window._startLogcatLive(); 'started'
```

▶ Run → через 3с в JS Logs:

```
[net] → GET /debug
[net] ← 200 GET /debug (140ms)
```

→ таймер запустился.

3. Console Eval → принудительный reload:

```js
reloadLogcat(); 'reloaded'
```

→ Logcat обновился ✅

4. Console Eval → проверить _LOGCAT_LIVE_ENABLED:

```js
_LOGCAT_LIVE_ENABLED
```

→ false → флаг отключён (v1.8.8) → раскомментировать/флаг true.

5. Console Eval → проверить <pre>:

```js
document.getElementById('logcat-pre') !== null
```

→ false → секция не отрисована (проверить, что data.logcat не пустой).

Диагностика таймера

Что Значение Действие
_logcatLiveTimer 123 ✅ работает
_logcatLiveTimer undefined _startLogcatLive()
_LOGCAT_LIVE_ENABLED false флаг true (v1.8.9)
#logcat-pre null loadDebugCard не запущен

---

📋 Пример 6: "Не помню, что в коде"

Симптом: знаю, что есть функция _fmtTime, но не помню, как работает.

Шаги

1. Sources → 📄 Sources (в DevTools секции):

2. Search _fmtTime:

```
... 4 matches / 80155b
```

3. Select → Ctrl+A → копировать всю app.js.

4. Copy → в clipboard.

5. Download → app.js в Downloads.

Или через Console Eval

```js
window._fmtTime.toString()
```

▶ Run → в output:

```js
function _fmtTime(ms) {
  var d = new Date(ms);
  var h = String(d.getHours()).padStart(2, '0');
  ...
}
```

→ видно исходник функции без открытия Sources.

Или все window._* функции:

```js
Object.keys(window).filter(k=>k.startsWith('_') && typeof window[k]==='function')
```

→ ["_jslogClear", "_perfReset", "_evalConsole", ...]

---

📋 Пример 7: "Что в localStorage?"

Симптом: тема слетает после перезагрузки.

Шаги

1. Application → 💾 Storage:

```
═══ localStorage (2) ═══
  mtapi-theme = dark
  something = value

═══ sessionStorage (0) ═══

═══ caches (0) ═══
```

2. Console Eval → проверить:

```js
localStorage.getItem('mtapi-theme')
```

→ "dark" ✅ / null ❌

3. Console Eval → установить вручную:

```js
localStorage.setItem('mtapi-theme', 'light'); 'set'
```

→ перезагрузить → тема light ✅ / dark ❌ (значит getItem не читается).

4. Console Eval → где читается:

```js
document.documentElement.getAttribute('data-theme')
```

→ "light" ✅ / "dark" ❌ (CSS/init не применил).

---

📋 Пример 8: "Процесс не виден в Processes (all)"

Симптом: Processes (all) — только 1 процесс (свой).

Шаги

1. Console Eval → вызвать Android.processList:

```js
typeof Android.processList
```

→ "function" ✅ / "undefined" ❌ (native bridge).

2. Console Eval → вызвать:

```js
Android.processList().slice(0, 200)
```

→ "=== mtapi process (1) ===..." — SELinux.

3. Console Eval → проверить /proc:

```js
fetch('/debug?token='+TOKEN).then(r=>r.json()).then(j=>console.log(j.data.processes))
```

→ "=== mtapi process (1) ===" — SELinux блокирует (Android 7+).

Диагноз: /proc только свой процесс. Для остальных — Shizuku API или root.

---

🎯 Шпаргалка: Console Eval — 20 команд

Проверка существования

```js
typeof window._evalConsole                       // "function" / "undefined"
document.getElementById('logcat-pre') !== null   // true / false
document.querySelectorAll('.ep').length          // 56
_jslogBuf.length                                 // N
```

Выполнить безопасно

```js
try { reloadLogcat(); 'OK' } catch(e) { 'ERR: ' + e.message }
```

Данные

```js
localStorage.getItem('mtapi-theme')
JSON.stringify(window._debugData).slice(0, 500)
window._perf                                     // {render: 23, loadDebugCard: 139}
```

DOM

```js
document.querySelector('.ep[data-path="/battery"] .ep-b').innerText
document.querySelector('button[onclick*="_evalConsole"]')
getComputedStyle(document.getElementById('jslog-pre')).display
```

Функции

```js
window._fmtTime.toString()                        // исходник
Object.keys(window).filter(k => k.startsWith('_')) // все _* переменные
```

Сеть

```js
var t=performance.now(); fetch('/battery?token='+TOKEN).then(r=>r.json()).then(j=>console.log('ms:', Math.round(performance.now()-t)))
```

Таймеры

```js
window._logcatLiveTimer                           // 123 / undefined
_LOGCAT_LIVE_ENABLED                              // true / false
window._statsTimer                                // от updateStats
```

Ошибки

```js
window.addEventListener('error', e => console.log('ERR: ' + e.message))  // для будущих
```

Storage

```js
JSON.stringify(Object.fromEntries(Object.entries(localStorage)))
caches.keys().then(ks => console.log(ks))
```

Сброс

```js
localStorage.clear(); location.reload()
window._perfReset(); window._jslogClear()
```

---

🎯 Шпаргалка: JS Logs — search-паттерны

Что ищу Search Уровни
Сетевые ошибки ✗ E (Error)
Медленные запросы [net] + смотреть (Nms) V, D
Все /debug /debug V
Ошибки JS Uncaught или error E, F
Eval результаты [eval] V
Perf reset perf reset V
DevTools devtools V, D
Пустой буфер _jslogBuf.length (Eval) —

---

🎯 Шпаргалка: Performance — что смотреть

Метрика Норма Проблема
render() < 50ms > 200ms — тяжёлый DOM
reloadLogcat() < 200ms > 500ms — /debug медленный
loadDebugCard() < 300ms > 500ms — logcat + processes

Если reloadLogcat большой → смотреть [net] ← GET /debug (Nms) в JS Logs. Если сервер отдаёт 500ms — Go-код. Если сеть 5ms, а reloadLogcat : 500ms — клиент (рендер, parse).

---

🎯 Шпаргалка: типовые баги → инструмент

Симптом Инструмент
Endpoint возвращает null Logcat + fetch в Eval
JS ошибка (Uncaught) JS Logs (Error)
Кнопка не работает Elements + _inspectDom
Функция undefined typeof window.fn в Eval
Медленный endpoint Performance + [net] timing
Таймер не тикает _logcatLiveTimer в Eval
Тема слетает Application + localStorage
DOM пустой querySelector в Eval
CSS скрывает getComputedStyle в Eval
Не помню код Sources → search

---

🚀 Workflow "типичный баг" — 60 секунд

```
1. /debug → JS Logs → search "error"
   → вижу Uncaught: h is not defined at app.js:1345

2. Console Eval → try { loadDebugCard() } catch(e) { e.message }
   → "h is not defined"

3. Sources → search "loadDebugCard"
   → вижу h += в .then() без var h

4. Патч → make apk → install

5. Проверка: JS Logs — нет error, Console Eval `try { loadDebugCard(); 'OK' }`
   → "OK"
```

От бага до фикса — 5 минут, без ПК.

---

📊 Итог — 8 инструментов

Инструмент Когда
Logcat Android-логи (сервер, ошибки, стек)
JS Logs console.* от app.js + [net] запросы
Console Eval выполнить JS: проверить, что есть
Performance ms для render/reloadLogcat/loadDebugCard
Sources прочитать app.js (search/select/copy)
Elements DOM: _inspectDom — id/class
Application localStorage/sessionStorage/caches
Processes /proc (свой), note про SELinux

Начните с JS Logs (search error) → Console Eval (проверить гипотезу) → Sources (найти баг).

---

Что попробуем отладить прямо сейчас? Если есть конкретный баг — пришлите симптом + /debug вывод (Logcat + JS Logs + Performance), дам точные команды для диагностики. 🎯
