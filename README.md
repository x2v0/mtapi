# mtapi

Go-based replacement for termux-api server.

## Layers

- `gocore/` — Go core, `gomobile bind` -> AAR
- `android/` — thin Kotlin APK, foreground service
- `client/` — Go CLI, talks to `@mtapi` abstract Unix socket

## Protocol

Newline-delimited JSON on abstract Unix socket `@mtapi`:

    {"auth":"<token>","method":"battery"}
    {"ok":true,"data":{"percentage":87,"charging":false}}

## Build

    bash scripts/build_aar.sh       # gomobile + NDK
    bash scripts/build_apk.sh       # Android SDK
    bash scripts/build_client.sh    # Go binaries

## Token

Android app shows token in MainActivity. Put it in `$MTAPI_TOKEN`
or `~/.config/mtapi/token`.

## Ops

    mtapi battery
    mtapi wifi
    mtapi toast "hi"
    mtapi clipboard set "hi"
    mtapi clipboard get
    mtapi torch on
    mtapi vibrate 200
    mtapi device
    mtapi location
    mtapi tts "hello"
    mtapi share --title x --text y
