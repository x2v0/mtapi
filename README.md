markdown
# mtapi — Android phone API over localhost HTTP

A Go server running as an Android subprocess that exposes 30+ Android APIs
as plain JSON-RPC over `http://127.0.0.1:7788`. **No Termux required** for
the app — any browser, script, or another app on the phone can use it.

## Architecture

APK (Java)
  MainActivity | ApiService (FGS)
    ├── GoServerLauncher → spawn libmtapi-server.so (fork+execve)
    ├── JavaBridge       ↔ stdin/stdout pipes (JSON lines)
    └── AndroidApiImpl   → Android SDK APIs

Go subprocess (libmtapi-server.so, ~6.6 MB, CGO_ENABLED=0):
  ├── HTTP :7788 on 127.0.0.1 (JSON-RPC)
  ├── bridge: pipes to Java
  └── token auth: Authorization: Bearer / ?token=

## Why Go subprocess and not JNI .so

On MediaTek MT6789 + Android 16, loading Go c-shared `.so` via `dlopen`
crashes with 4 upstream Go bugs (golang/go#81051, #82111, #82260, #82753):
getauxval SIGSEGV, `_cgo_init` undefined, crosscall2 missing, tlsg uninitialized.
Running Go as a **separate process** sidesteps all of them.

## Quick start (Termux)

mkdir -p ~/.config/mtapi
rish -c 'cat /sdcard/Android/data/dev.mtapi/files/token.txt' > ~/.config/mtapi/token

mkdir -p ~/bin && cp ~/mtapi/bin/mtapi ~/bin/ && chmod +x ~/bin/mtapi
export PATH="$PATH:$HOME/bin"

mtapi ping
mtapi battery | jq .data
mtapi contacts 5 | jq '.data[] | "\(.name) — \(.phone)"'
mtapi toast "hello"
mtapi torch on && sleep 1 && mtapi torch off

## Quick start (PC)

adb forward tcp:7788 tcp:7788
TOKEN=$(cat ~/.config/mtapi/token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:7788/system | jq

## Endpoints

Base: `http://127.0.0.1:7788`. Auth: `Authorization: Bearer <token>` or `?token=<token>`.
Response: `{"ok":true,"data":<...>}` or `{"ok":false,"error":"..."}`.

### Basic
- `/ping` — `{"pong":true}`
- `/battery`, `/wifi`, `/device`, `/location`
- `/clipboard`, `/clipboard?op=set&text=X`
- `/toast?text=X`, `/notify?title=X&body=Y`
- `/vibrate?ms=N`, `/torch?on=1`, `/torch/brightness?level=0..100`
- `/tts?text=X`, `/share?title=X&text=Y`
- `/contacts?limit=N`, `/calllog?limit=N`
- `/sms?limit=N`, `/sms?op=send&to=X&text=Y`

### System
- `/system` — CPU cores/ABI, RAM, build.*, uptime
- `/cpu/detail` — per-core freq, governor, load avg
- `/thermal` — thermal zones (type, temp_c)
- `/memory` — /proc/meminfo
- `/storage` — volumes + free/total
- `/kernel` — uname, boot time

### Network
- `/network` — interfaces, IPs, active transport
- `/wifi/detailed` — SSID, BSSID, freq, linkSpeed
- `/bluetooth` — adapter + bonded devices
- `/telephony` — SIM, operator, signal dBm

### Display / audio
- `/display` — WxH, DPI, modes, HDR, refresh
- `/display/brightness`, `/display/color`
- `/audio`, `/microphone`

### Sensors
- `/sensors` — all sensors with caps
- `/sensors/read?name=accelerometer&ms=500`

### Hardware
- `/features` — hardware features (NFC, BT, ...)
- `/camera/list` — cameras + sensor, focal, aperture, ISO
- `/camera/snapshot` — take JPEG
- `/microphone/record?seconds=N` — record AAC

### Detailed
- `/battery/detailed` — voltage, temp, health, current
- `/location/detailed` — all providers
- `/locale` — language, timezone, 24h

### JSON-RPC
POST /call  {"method":"battery","params":{}}

## CLI (`~/bin/mtapi`)

mtapi ping / battery / device / location/detailed
mtapi contacts 5 | jq '.data[] | .name'
mtapi toast "hi" / notify "T" "B" / vibrate 200
mtapi torch on / mtapi torch 50 / mtapi torch off
mtapi sensors | jq '.data[] | .name'
mtapi sensors/read accelerometer 500
mtapi cpu | jq '.data.perCore[]'
mtapi thermal | jq '.data[] | {type, temp_c}'
mtapi camera/snapshot
mtapi microphone/record 3
mtapi sms send +100 "hi"

## Build (no gradle, no gomobile, no kotlinc)

cd ~/mtapi
make server     # go build → libmtapi-server.so
make apk        # wta build → mtapi-debug.apk
make install    # rish / termux-open
make grant      # permissions via rish
make live       # verify 13 endpoints
make cli        # install ~/bin/mtapi

## Project layout

gocore/cmd/mtapi-server/     Go HTTP + bridge
  main.go  api.go  bridge.go  http.go
android/app/src/main/java/dev/mtapi/
  MainActivity  ApiService  GoServerLauncher
  JavaBridge  AndroidApiImpl  AndroidAPI
  Token  DiagLog  App  BootReceiver
android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so
bin/mtapi                    CLI wrapper
scripts/build_server.sh      CGO_ENABLED=0 GOOS=android/arm64
mtapi.yaml                   w2a config
Makefile                     one-shot targets

## Security

- Bind 127.0.0.1 only (not on WiFi)
- Token required on every request
- Token: 24 random bytes hex (SecureRandom)
- Storage: shared_prefs + appExternal + best-effort /sdcard/Download
- Manifest: INTERNET, usesCleartextTraffic, network_security_config.xml

## Known limitations

- `/thermal`, `/cpu/detail` — some values may be empty without root
- `/camera/snapshot` from background may be blocked by MIUI/HyperOS
- `/microphone/record` requires exclusive mic access

## Docs

- `ARCHITECTURE.md` — design decisions, why subprocess
- `CHANGELOG.md` — version history
