# MTAPI — Mobile Terminal API

Превращает Android-телефон в локальный HTTP-сервер с 30+ REST endpoints для автоматизации, диагностики и интеграций.

Один APK → Go-сервер на `127.0.0.1:7788` + WebView UI + доступ к нативным API через token-auth.

---

## Features

- **30+ HTTP endpoints** — battery, wifi, location, contacts, sms, camera, sensors, tts, apps, files, logcat
- **Token auth** — `?token=...` (генерируется при первом запуске)
- **Runtime permissions** — 18+ dangerous, запрос при старте
- **WebView UI** — без внешних зависимостей, чистый JS/CSS
- **Table search** — filter + copy filtered (не весь массив)
- **JS Logs** — замена DevTools Console без ПК (live + search + reverse)
- **DevTools via abstract socket** — `/devtools/json` без adb/forward
- **Refresh-on-toggle** — Memory/Processes/Errors обновляются при раскрытии
- **Release APK** — `debuggable=false`, V3.0 signed, `CN=mtapi`

---

## Quick start

### Build APK

```bash
cd ~/mtapi
make apk                # собрать .so + mtapi.apk (~30s)
# → build/mtapi.apk
# → /sdcard/Download/mtapi.apk
```

### Install

```bash
make install            # через rish (Shizuku) / adb
# или вручную: /sdcard/Download/mtapi.apk → Install
```

### Run

1. Открыть mtapi → разрешить все permissions (диалог при старте)
2. Открыть `GET /ping` → `pong: true`
3. Открыть `GET /battery` → `percentage: 87, charging: false`

---

## Make commands

| Команда | Что делает | Время |
|---------|-----------|-------|
| `make ci` | test → lint → apk — полный пайплайн перед коммитом | ~30s |
| `make test` | все тесты (nodup + universal) | ~20s |
| `make lint` | `node --check` на все `.js` + ESLint | ~10s |
| `make check` | алиас для `make test` | ~20s |
| `make build` | `.so` + APK | ~30s |
| `make apk` | `.so` → APK (без цикла) | ~25s |
| `make so` | только `.so` (Go cross-compile) | ~10s |
| `make install` | APK → телефон через `rish` / `adb` | ~5s |
| `make clean` | `build/`, `*.idsig`, `*.tmp` (НЕ трогает `.so`) | ~1s |
| `make distclean` | + `*.bak`, binary, log, temp | ~2s |
| `make clean-dry` | preview перед clean/distclean | ~1s |
| `make readme` | открыть этот README в less/cat | ~1s |

**Workflow перед коммитом:**

```bash
make ci          # если OK — можно коммитить
git add -A
git commit -m "feat: ..."
```

---

## Endpoints

### Basic

```
GET /ping                          → pong
GET /battery                       → percentage, charging
GET /wifi                          → ssid, rssi, link_speed
GET /device                        → manufacturer, model, sdk
GET /location                      → lat, lon (permission)
GET /clipboard                     → text
GET /clipboard?op=set&text=hello   → set clipboard
GET /toast?text=hello              → toast
GET /notify?title=Hi&body=There    → notification
GET /vibrate?ms=200                → vibrate
GET /torch?on=1                    → flashlight on/off
GET /torch/brightness?level=50     → 0-100
GET /tts?text=hello                → speak
GET /share?title=Hi&text=There     → share intent
```

### Contacts / SMS (READ_CONTACTS, READ_CALL_LOG, READ_SMS)

```
GET /contacts?limit=0              → contact list
GET /calllog?limit=0               → call history
GET /sms?limit=0                   → SMS
```

### System

```
GET /system                        → cpu, ram, uptime
GET /cpu/detail                    → per-core freq
GET /thermal                       → thermal zones
GET /memory                        → /proc/meminfo (40+ полей)
GET /storage                       → /data, /sdcard sizes
GET /kernel                        → os_version, arch
```

### Network

```
GET /network                       → interfaces, connectivity
GET /wifi/detailed                 → bssid, frequency, tx/rx
GET /bluetooth                     → available, enabled (BLUETOOTH_CONNECT)
GET /telephony                     → sim state, operator, signal
GET /wifi/scan                     → nearby networks (ACCESS_FINE_LOCATION)
GET /net/ping?host=8.8.8.8&count=3 → ICMP via TCP fallback
GET /net/dns?host=example.com      → resolve
GET /net/fetch?url=...             → HTTP GET proxy
```

### Display / Audio

```
GET /display                       → resolution, refresh, HDR
GET /display/brightness            → 0-255
GET /display/color                 → wide color gamut, HDR
GET /audio                         → music active, ringer mode
GET /microphone                    → mic capabilities
GET /audio/volume?stream=2         → 0-15
GET /audio/ringer                  → normal/vibrate/silent
```

### Sensors (BODY_SENSORS)

```
GET /sensors                                  → list (30+)
GET /sensors/read?name=accelerometer&ms=200   → 92 samples
GET /sensors/stream?name=accelerometer&hz=10  → start stream
GET /sensors/stream/stop?name=accelerometer   → stop
```

### Hardware (CAMERA, RECORD_AUDIO)

```
GET /features                      → PackageManager features
GET /camera/list                   → cameras + parameters
GET /camera/snapshot               → JPEG (base64)
GET /microphone/record?seconds=3   → audio
```

### Apps (QUERY_ALL_PACKAGES)

```
GET /app/list                      → installed apps (450+)
GET /app/launch?pkg=com.android.settings
```

### Detailed (permissions)

```
GET /battery/detailed              → voltage, temp, current, health
GET /location/detailed             → GPS coordinates
GET /locale                        → language, timezone, 24h
GET /calendar?days=7               → events (READ_CALENDAR)
GET /alarm/next                    → next alarm
```

### Files / Audio play

```
GET /files/save?name=test.txt&data=hello    → /sdcard/Download/test.txt
GET /audio/play?uri=/system/media/...       → play audio
GET /audio/play/stop                        → stop
GET /tts/voices                             → 400+ voices
GET /tts/stop                               → stop TTS
```

### Watch (logcat streaming)

```
GET /clipboard/watch?hz=2          → watch clipboard
GET /clipboard/watch/stop
GET /location/watch?hz=1           → watch location
GET /location/watch/stop
```

### Debug

```
GET /debug                         → processes, port, uptime, memory,
                                     logcat (50), errors, devtools
GET /devtools/json                 → WebView pages (без adb!)
POST /restart                      → restart Go server
```

---

## Permissions

Запрашиваются автоматически в `MainActivity.onCreate()` через `requestAllPermissions()`.

| Permission | Зачем | Endpoint |
|-----------|-------|----------|
| `CAMERA` | Снимок | `/camera/snapshot` |
| `RECORD_AUDIO` | Запись с микрофона | `/microphone/record` |
| `READ_CONTACTS` | Контакты | `/contacts` |
| `READ_CALL_LOG` | Журнал звонков | `/calllog` |
| `READ_SMS` | SMS | `/sms` |
| `READ_CALENDAR` | События | `/calendar` |
| `ACCESS_FINE_LOCATION` | GPS, WiFi scan | `/location`, `/wifi/scan` |
| `READ_PHONE_STATE` | SIM, сигнал | `/telephony` |
| `BLUETOOTH_CONNECT` (12+) | Bluetooth | `/bluetooth` |
| `POST_NOTIFICATIONS` (33+) | Notifications | `/notify` |

**Особенность MIUI/HyperOS:** permissions сбрасываются при переустановке APK → диалог показывается снова. Это норма ROM, не баг.

Если отказали — **Настройки → mtapi → Разрешения** → включить вручную.

---

## Release

### APK

- **Package:** `dev.mtapi`
- **Output:** `build/mtapi.apk` → `/sdcard/Download/mtapi.apk`
- **Подпись:** V3.0, `CN=mtapi, OU=Mobile Terminal API, O=MTAPI, L=Termux, ST=NA, C=RU`
- **SHA-256:** `d74ec1436bf025614a99fecb23ab557687dcf9272d5521e4a799d18216311d3a`
- **`debuggable`:** `false` → `run-as` заблокирован, `TOKEN` не читается через adb

### Keystore

- **Файл:** `~/.config/w2a/keystore.p12`
- **Пароль:** `ihepsuka`
- **Alias:** `wta`
- **Config:** `~/.config/w2a/sign.yaml` (`ksPass: pass:ihepsuka`)

**КРИТИЧНО:** без keystore + пароля не выпустить обновление. Сохраните в надёжном месте:

```bash
cp ~/.config/w2a/keystore.p12 ~/.config/w2a/sign.yaml /sdcard/Download/
# → загрузить в облако
```

---

## DevTools (WebView inspection)

`/devtools/json` работает без adb, без ПК, без wireless debugging. Go-сервер и WebView — один UID, поэтому Go подключается к abstract socket `@webview_devtools_remote_<PID>` напрямую.

### In-app

`/debug` → **DevTools** секция → `1 page(s)` + кнопки:

- **Copy WS** — `ws://localhost:9222/devtools/page/...` в clipboard
- **DevTools** — info-блок с инструкциями

### PC (полный Chrome DevTools)

```bash
# На ПК:
adb shell pidof dev.mtapi          # → 5387
adb forward tcp:9222 localabstract:webview_devtools_remote_5387
# chrome://inspect/#devices → mtapi → inspect
```

**Почему `:9222`:** WebView отдаёт `ws://localhost/...` (без порта). `_normalizeDevtoolsWs()` добавляет `:9222`. Для ПК через `adb forward` нужен именно `ws://localhost:9222/...`.

---

## JS Logs (замена DevTools Console без ПК)

**Проблема:** MIUI/HyperOS при `debuggable=false` блокирует chromium-логи → `console.log` не видны в logcat. Без ПК DevTools недоступен.

**Решение:** `MTAPI_JSLOG` в `app.js`:

- `console.log/warn/error/info/debug` → `window._jslogBuf` (ring, 500 строк)
- `window.addEventListener(error)` — uncaught exceptions
- `window.addEventListener(unhandledrejection)` — промисы
- Секция **JS Logs (N)** в `/debug` — открыта по умолчанию
- **Live append** — новые логи появляются сразу (без reload)
- **Search** (`filterJsLog`) — отдельно от logcat
- **Clear** (`_jslogClear`)
- **Reverse** — новые сверху

**Пример:**

```
10:34:56 [log] [mtapi] copied 3118b
10:34:55 [log] [mtapi] copy filtered by "dev"
10:34:30 [log] [mtapi] devtools WS copied
10:31:24 [log] [mtapi] MTAPI_HARD_RESET_76 loaded
```

---

## Table search

Автоматически появляется, если в таблице **> 15 строк** (`/contacts`, `/calllog`, `/sms`, `/app/list`, `/calendar`, `/sensors/read`, Memory, Features, Processes-all).

- **Filter** — строки фильтруются по тексту
- **Подсветка** — `<mark>` жёлтый
- **Счётчик** — `X/N`
- **Debounce** — 150ms
- **Copy filtered** — кнопка 📋 копирует только отфильтрованные items (не весь массив)

**Пример:** `/app/list` (450) → filter `dev` → 20 items → tap 📋 → JSON с 20 items (3118b), не 450.

---

## Refresh-on-toggle

Секции `/debug` обновляются при раскрытии:

- **Memory** — Go heap, sys, GC
- **Processes** — `ps -A | grep mtapi`
- **Processes (all)** — `Android.processList()` (ActivityManager)
- **Errors** — FATAL/ANR
- **Uptime** — Go server uptime

Реализовано через `data-refresh-field="<field>"` + `_attachRefreshOnToggle`.

---

## Troubleshooting

### Permissions не выданы

**Симптом:** `/contacts` → `permission_required: android.permission.READ_CONTACTS`
**Решение:** Настройки → mtapi → Разрешения → включить. Или переустановить APK (диалог появится снова).

### APK не устанавливается

**Симптом:** `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
**Причина:** подпись APK ≠ подпись установленного
**Решение:** удалить приложение → установить заново (данные будут потеряны).

### Кнопки DevTools не работают

**Симптом:** tap → ничего не происходит
**Причина:** inline `onclick` с кавычками — HTML-парсер обрывает атрибут
**Решение:** кнопки используют `data-action` + `data-ws` + `addEventListener` (event delegation).

### DevTools → Not Found

**Симптом:** tap DevTools → 404
**Причина:** мёртвый `chrome-devtools-frontend.appspot.com/serve_file/@/inspector.html`
**Решение:** убран в v1.7.2. Теперь только info-блок + Copy WS.

### logcat не показывает console.log

**Симптом:** `/debug` → Logcat → поиск `chromium` → пусто
**Причина:** MIUI/HyperOS при `debuggable=false` блокирует chromium-логи
**Решение:** использовать **JS Logs** (`/debug` → секция JS Logs).

### make clean удаляет .so

**Симптом:** после `make clean` приложение не собирается
**Причина:** старый `clean` содержал `rm -f ...libmtapi-server.so` (tracked в git!)
**Решение:** `git checkout HEAD -- android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so`. Новый `clean` (v1.7.0) `.so` не трогает.

### make: Circular build <- apk dependency dropped

**Симптом:** warning при `make apk`
**Причина:** `apk: build`, а `build: so apk` → цикл
**Решение:** `apk: so` (v1.7.0+). Разрывает цикл.

---

## Changelog

### v1.7.3

- `make ci` / `lint` / `check` targets
- refresh-on-toggle (Memory/Processes/Errors/Processes-all)
- JS Logs reverse (новые сверху)

### v1.7.2

- refresh-on-toggle для секций /debug
- JS Logs reverse

### v1.7.1

- **JS Logs** в `/debug` — замена DevTools Console без ПК
- **DevTools** `/devtools/json` через abstract socket (без adb)
- `_normalizeDevtoolsWs`: `ws://localhost/...` → `ws://localhost:9222/...`
- `_copyEndpointJson` учитывает активный filter таблицы

### v1.7.0

- **Runtime permissions** (18+) в `MainActivity.requestAllPermissions()`
- **Table search** с подсветкой + copy filtered
- **Красный border** на endpoint с ошибкой (`ep-err`)
- **Group counter** `Basic (16) — 14/16 ✓`
- **Release APK** (`debuggable=false`, `mtapi.apk`, `CN=mtapi`)
- **`make apk: so`** — без цикла
- **`make clean`** — НЕ удаляет tracked `.so`

### v1.6.x

- 15 bugfixes в `app.js` / `sw.js` (дубликаты, AbortController guard, timer leak, debounce, XSS)
- Revert MTAPI_392/396/397 (сломанный hot-reload)
- `make clean` targets

---

## File structure

```
mtapi/
├── Makefile                    # ci/lint/test/apk/install/clean
├── README.md                   # этот файл
├── android/app/src/main/
│   ├── AndroidManifest.xml     # permissions + activity
│   ├── java/dev/mtapi/
│   │   └── MainActivity.java   # requestAllPermissions + WebView + JS-interface
│   ├── jniLibs/arm64-v8a/
│   │   └── libmtapi-server.so  # Go server (tracked!)
│   └── res/
├── gocore/
│   ├── go.mod
│   ├── cmd/mtapi-server/
│   │   ├── main.go
│   │   ├── http.go             # endpoints + /devtools/json
│   │   ├── bridge.go           # Java bridge API
│   │   ├── app.js              # WebView UI (1500+ строк)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── sw.js               # self-destruct SW
│   └── mobile/                 # gomobile для .so
├── test/
│   ├── mtapi-app.test.js       # exports, esc, renderData
│   ├── mtapi-acorn.test.js     # парсит app.js
│   ├── mtapi-eslint.test.js    # ESLint
│   ├── mtapi-jsdom.test.js     # DOM через jsdom
│   ├── mtapi-syntax.test.js    # node --check + getElementById
│   ├── mtapi-nodup.test.js     # регрессии (17 тестов)
│   └── mtapi-universal-js.test.js  # все .js (10 тестов)
├── scripts/
│   ├── build_server.sh         # Go cross-compile
│   └── test-runner.sh
└── tools/
```

---

## Development

### Test suites (82/82 PASS)

| Файл | Тестов | Что проверяет |
|------|--------|--------------|
| `mtapi-app.test.js` | ~30 | exports, esc, renderData, renderObj, renderCell |
| `mtapi-acorn.test.js` | 2 | парсит app.js без ошибок |
| `mtapi-eslint.test.js` | 1 | ESLint (no-undef, no-shadow) |
| `mtapi-jsdom.test.js` | 7 | DOM через jsdom |
| `mtapi-syntax.test.js` | ~7 | node --check + getElementById |
| `mtapi-nodup.test.js` | 17 | регрессии: дубликаты, saveAppJs, clients.claim, `.so`, clean, logcat live, uptime, filtered copy, refresh-on-toggle, reverse |
| `mtapi-universal-js.test.js` | 10 | все .js: syntax, UTF-8, merge markers, debugger, dup funcs, eval |

**Регрессии из сессии** (все покрыты тестами):

- Дубликаты `esc`/`cellStr`/`classifyValue` → nodup
- `saveAppJs` вернулся → nodup (stripComments)
- `clients.claim()` в `sw.js` → nodup (stripComments)
- `.so` пропал / `< 7MB` → nodup
- `Makefile clean rm .so` → nodup
- `logcat live` сломан → nodup
- `uptime refresh` сломан → nodup
- `JS Logs reverse` → nodup
- `refresh-on-toggle` → nodup

### Build .so

```bash
make so                  # cross-compile для Android arm64
# → android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so
```

### Debug JS (без ПК)

`/debug` → **JS Logs** — все `console.log/warn/error` из `app.js`, включая uncaught exceptions.

---

## License

MIT (или своя — укажите)

## Author

MTAPI — Mobile Terminal API. Сделано в Termux.
