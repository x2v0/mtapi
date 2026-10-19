# Changelog

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
