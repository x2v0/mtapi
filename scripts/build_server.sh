#!/usr/bin/env bash
cd ~/mtapi
set -uo pipefail
mkdir -p ~/tmp
export TMPDIR=~/tmp

# Clean Go binary for android/arm64, no cgo
export CGO_ENABLED=0
export GOOS=android
export GOARCH=arm64

OUT=android/app/src/main/jniLibs/arm64-v8a
mkdir -p "$OUT"
rm -f "$OUT/libgojni.so" "$OUT/libstub_gojni.so"

echo "building mtapi-server (CGO_ENABLED=0 android/arm64)..."
( cd gocore && go build -trimpath -ldflags="-s -w" -o "../$OUT/libmtapi-server.so" ./cmd/mtapi-server )
rc=$?
if [ $rc -ne 0 ]; then
    echo "build FAILED"
    exit 1
fi

echo "file:"
file "$OUT/libmtapi-server.so"
echo "size:"
ls -lh "$OUT/libmtapi-server.so"
echo "needed:"
readelf -dW "$OUT/libmtapi-server.so" | grep NEEDED || echo "  (static, no NEEDED)"

# MTAPI_265: копировать .so в Downloads
mkdir -p /sdcard/Download 2>/dev/null || true
cp -f "$OUT" /sdcard/Download/libmtapi-server.so 2>/dev/null || true
echo "  .so → /sdcard/Download/libmtapi-server.so"
