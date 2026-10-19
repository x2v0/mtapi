# mtapi — Architecture

## TL;DR

- Go server runs as Android subprocess (fork+execve), not as .so in APK.
- External clients: HTTP JSON-RPC on 127.0.0.1:7788.
- Java↔Go bridge: stdin/stdout pipes (JSON lines with id).
- Token auth: Authorization: Bearer or ?token= query.
- Bind 127.0.0.1 only.

## Why not JNI / c-shared .so

Original approach used gomobile bind and hand-built c-shared JNI .so.
Both crash on MediaTek MT6789 + Android 16 for upstream Go bugs:

| Bug | Issue | Symptom |
|---|---|---|
| getauxval SIGSEGV | #82753 | signal 11 in .init_array |
| _cgo_init undefined | #82655 | "pthread_create failed" |
| crosscall2 missing | #82111 | undefined symbol |
| tlsg uninitialized | #82260 | SIGABRT on first goroutine |
| 1.27 c-shared regression | #81051 | works on 1.26, crashes on 1.27 |

Attempts that did NOT fix:
- -linkmode=external -extld=clang → ignored on android/arm64
- -X runtime.auxvFile=/proc/self/auxv → no effect in c-shared
- --defsym=getauxval=my_getauxval → SIGSEGV moved to pthread_create
- --defsym=_cgo_init=x_cgo_init → next crash in x_cgo_sys_thread_create
- Patch $GOROOT/src/runtime/tls_arm64.s → overlapping DATA entry
- Patch $GOROOT/src/runtime/cgo/gcc_util.c → still pthread_create EAGAIN
- Version script, weak refs, __attribute__((alias)) → no help
- Downgrade Go 1.21/1.23 (linux/arm64 from go.dev) → SIGSYS on faccessat2
  (syscall 439, blocked by Termux seccomp)

What worked: Go as standalone binary — no dlopen, no JNI.
Termux itself does this with its Go tools on the same device.

## Process model

PID 1234  dev.mtapi  (APK main process)
  ├─ Activity  MainActivity
  ├─ Service   ApiService (foreground, START_STICKY)
  │     ├─ GoServerLauncher.start()
  │     │     ProcessBuilder(libmtapi-server.so).start()
  │     │     → PID 1235  libmtapi-server.so
  │     ├─ JavaBridge
  │     │     reader: process.getInputStream() → dispatch → write back
  │     │     writer: JSON lines to process.getOutputStream()
  │     └─ AndroidApiImpl
  │
  └─ PID 1235  libmtapi-server.so  (Go)
        ├─ HTTP server on 127.0.0.1:7788
        ├─ bridge.start() reads responses from stdin
        └─ On HTTP request: bridge.call(method, params)
             → writes JSON to stdout
             → blocks on stdin response
             → returns to HTTP handler

Child inherits parent seccomp profile — that's why INTERNET permission is
required. Without it, socket() is blocked for both Java and subprocess.

## Bridge protocol

Request (Go → Java), one JSON per line:
{"id":1,"method":"batteryStatus","params":{}}

Response (Java → Go):
{"id":1,"ok":true,"data":{"percentage":98,"charging":false}}

Error:
{"id":1,"ok":false,"error":"permission_required: android.permission.READ_SMS"}

Add new method — 7 steps:
1. AndroidAPI.java — interface signature
2. AndroidApiImpl.java — implementation
3. JavaBridge.java — case "name": return api.name(...)
4. api.go — Go interface
5. api.go — func (a *bridgeAPI) Name(...) { return a.b.callStr("name", ...) }
6. http.go — case "name": ... in dispatch
7. http.go — add to methods := []string{...}

## Response shape

s.ok(w, data) parses data if json.Valid, wraps into {"ok":true,"data":<parsed>}.
So battery returning raw {"percentage":98} becomes
{"ok":true,"data":{"percentage":98}} — not a double-encoded string.

## Token storage

24 random bytes hex. Locations:
- shared_prefs/mtapi — internal, app-only
- getExternalFilesDir/token.txt — readable via rish -c cat
- /sdcard/Download/mtapi.token — MediaStore (API 29+), best-effort

External clients get token via rish -c cat appExternal/token.txt
on first run, cache in ~/.config/mtapi/token.

## Build pipeline

gocore/cmd/mtapi-server/*.go
  ↓ CGO_ENABLED=0 GOOS=android GOARCH=arm64 go build -ldflags="-s -w"
libmtapi-server.so (6.6 MB, static)
  ↓ wta build (~/w2a type: custom)
  ├── javac --release 17 → .class
  ├── d8 → classes.dex
  ├── aapt2 compile+link → base.apk
  ├── inject libmtapi-server.so + classes.dex (STORED)
  ├── zipalign -P 16
  └── apksigner sign
mtapi-debug.apk (~10 MB)

No gradle, no gomobile, no kotlinc. All in Termux.

## Why libmtapi-server.so and not assets/

Android only extracts lib/<abi>/*.so to nativeLibraryDir (executable).
Files in assets/ go to codeCacheDir — executable but require manual
extract + chmod +x at first launch. Renaming Go binary to lib*.so is
the standard "hide native binary in APK" trick.
