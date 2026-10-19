#!/usr/bin/env bash
cd ~/dwn/mtapi
mkdir -p ~/tmp
export TMPDIR=~/tmp
set -euo pipefail

mkdir -p client/dist
cd client

# arm64 (Go 1.22+, pure-Go net, no cgo needed)
echo "building android/arm64"
GOOS=android GOARCH=arm64 CGO_ENABLED=0 \
    go build -ldflags="-s -w" -o dist/mtapi-android-arm64 .

# 32-bit arm needs cgo against Bionic; skip gracefully if no NDK
echo "building android/arm (optional; needs NDK+cgo)"
if [ -n "${ANDROID_NDK_HOME:-}" ] || [ -n "${NDK:-}" ]; then
    GOOS=android GOARCH=arm CGO_ENABLED=1 \
        go build -ldflags="-s -w" -o dist/mtapi-android-arm . \
      || echo "  WARN: arm build failed (continuing)"
else
    echo "  SKIP: ANDROID_NDK_HOME not set"
fi

# host binary (for integration tests / running on Termux itself)
echo "building linux/amd64"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
    go build -ldflags="-s -w" -o dist/mtapi-linux-amd64 .

# Termux on-device build (native, same arch as host)
echo "building native (${GOOS:-host})"
CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/mtapi-native . 2>/dev/null || true

echo
echo "client binaries:"
ls -la dist/
