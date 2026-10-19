## [1.3.0] — 2026-10-19

Web UI dashboard on `/` — click any endpoint → fetch → table.

### Added
- `index.html` embedded via `//go:embed` in `index.go`
- `/` serves SPA dashboard:
  - grouped endpoint list (11 groups, 50+ endpoints)
  - search/filter
  - click → live fetch → table rendering
  - `{ }` toggle for raw JSON
  - per-request timing (ms)
  - auto-runs `/ping` on load
  - error highlighting (permission_required, timeouts)
  - copy-token button
- `http.go`: `handleIndex` uses `strings.ReplaceAll(indexHTML, "{{TOKEN}}", s.token)`

### Changed
- Previously `/` was static HTML list; now fully interactive

### Rendering rules
- object → key-value table
- array of objects → table with all keys as columns
- array of scalars → single-column table
- null / empty → grey `(empty)` hint
- nested object → shown as compact `{"k":"v"}`, expandable via `{ }`

## [1.1.0] — 2026-10-19

Universal features — works on any Android 8+ device, no root, no Shizuku,
no special dialogs.

### Added
- **Sensors SSE stream** — `/sensors/stream?name=X&hz=N`, `/sensors/stream/stop?name=X`
  Streams sensor readings via logcat tag `mtapi-sse`
- **Audio control** — `/audio/volume?stream=N[&level=M]` (GET+SET),
  `/audio/ringer[?mode=silent|vibrate|normal]` (GET+SET)
- **WiFi scan** — `/wifi/scan` (startScan + getScanResults fallback)
- **App list + launch** — `/app/list`, `/app/launch?pkg=X`
- **Network utils** — `/net/ping?host=X&count=N`, `/net/dns?host=X`,
  `/net/fetch?url=X` (HTTP GET from phone)

### Fixed
- `s.writeJSON` → `s.ok` for audio/sensors — data is now a JSON object,
  not a double-encoded string
- Manifest: +CHANGE_WIFI_STATE +NEARBY_WIFI_DEVICES
- `wifiScan`: getScanResults fallback when startScan is throttled

### Requires (auto-requested on first run, or `make grant`)
- `ACCESS_FINE_LOCATION` + location enabled (for `/wifi/scan`)
- Nothing else beyond what v1.0.0 needed

### Notes
- `/wifi/scan` returns `[]` if WiFi is off or location service disabled
- `/sensors/stream` writes to logcat tag `mtapi-sse`, not to HTTP body
  (for HTTP streaming use `/sensors/read` which snapshots)

## [1.0.0] — 2026-10-19

First working release. Go server as Android subprocess, HTTP API on
127.0.0.1:7788, ~30 endpoints, CLI wrapper, full docs.

### Architecture
- Go runs as fork+execve subprocess (not JNI .so)
- HTTP JSON-RPC on 127.0.0.1:7788
- stdin/stdout pipes bridge Go <-> AndroidApiImpl
- Token auth, bind 127.0.0.1 only

### Endpoints
- Basic:    /ping /battery /wifi /device /location /clipboard
            /toast /notify /vibrate /torch /torch/brightness
            /tts /share /contacts /calllog /sms (list+send)
- System:   /system /cpu/detail /thermal /memory /storage /kernel
- Network:  /network /wifi/detailed /bluetooth /telephony
- Display:  /display /display/brightness /display/color
- Audio:    /audio /microphone
- Sensors:  /sensors /sensors/read
- Hardware: /features /camera/list /camera/snapshot /microphone/record
- Detailed: /battery/detailed /location/detailed /locale
- RPC:      POST /call

### Added
- gocore/cmd/mtapi-server: main.go, api.go, bridge.go, http.go
- GoServerLauncher.java (fork+execve)
- JavaBridge.java (pipes dispatcher)
- AndroidApiImpl.java (20+ methods)
- HTML index at / with clickable endpoints
- CLI wrapper bin/mtapi (24 commands)
- Makefile: server/apk/install/grant/verify/live/cli/all/clean

### Fixed
- Manifest: INTERNET, usesCleartextTraffic, network_security_config.xml
- data field: JSON object (not string) via JSONTokener in JavaBridge
- Array fields: String.join for Build.SUPPORTED_ABIS, JSONArray for
  AudioDeviceInfo.getSampleRates / getChannelCounts
- Token file: appExternal primary + /sdcard/Download via MediaStore

### Known issues
- /thermal, /cpu/detail — some values need root
- /camera/snapshot from background may be blocked by MIUI/HyperOS
- /microphone/record requires exclusive mic access

### Attempted and abandoned (see ARCHITECTURE.md)
JNI .so with Go c-shared — blocked by 4 upstream Go bugs on MTK MT6789
(issues #81051, #82111, #82260, #82753). Subprocess sidesteps all.

## [0.x] — history
- 00-20: skeleton — Go core, JSON-UDS, gRPC, Java Android, gradle+gomobile
- 21-24: Go tools (verify/integration/grpc-e2e), w2a integration
- 25-28: Java rewrite (drop Kotlin/AndroidX/CameraX), w2a type:custom
- 27-28z: JNI c-shared experiments (abandoned)
- 29: rewrite to Go subprocess — first working APK
- 30-33: token extraction, JSON shape, permissions, INTERNET
- 34-36: system/cpu/thermal/memory/network/wifi/bt/display/audio/
  mic/kernel/sensors endpoints
- 37-38: MediaStore token, Camera2 snapshot, MediaRecorder, torch brightness
- 39-40: CLI wrapper, README, ARCHITECTURE, CHANGELOG, v1.0.0
