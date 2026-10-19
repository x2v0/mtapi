#!/usr/bin/env bash
cd ~/dwn/mtapi
set -uo pipefail
mkdir -p ~/tmp
export TMPDIR=~/tmp

WRAPPER=~/dwn/mtapi/scripts/clang-android26.sh
OUT=android/app/src/main/jniLibs/arm64-v8a
ERR=~/tmp/cshared.err
mkdir -p "$OUT"
: > "$ERR"

echo "WRAPPER = $WRAPPER"
echo "OUT     = $OUT/libgojni.so"
echo "ERRLOG  = $ERR"
echo

cd gocore

echo ">>> c-shared"
if CC="$WRAPPER" \
   CGO_ENABLED=1 \
   GOOS=android GOARCH=arm64 \
   CGO_CFLAGS="-O2 -fPIC" \
   go build -buildmode=c-shared -trimpath \
       -tags=android \
       -ldflags="-s -w" \
       -o "../$OUT/libgojni.so" \
       ./jni 2>"$ERR"; then
    echo "c-shared: OK"
else
    rc=$?
    echo "c-shared: FAILED (rc=$rc)"
    echo
    echo "--- stderr (first 120 lines) ---"
    head -120 "$ERR" || true
    echo "--- end ---"
    echo
    echo "NOTE: -buildmode=c-archive is NOT supported on android/arm64."
    echo "      Only c-shared can work. See error above."
    exit 1
fi

echo
echo "file:"
file "../$OUT/libgojni.so"
echo
echo "symbols:"
nm -D --defined-only "../$OUT/libgojni.so" 2>/dev/null | grep Java_dev_mtapi || echo "  (none)"
echo
echo "deps:"
readelf -d "../$OUT/libgojni.so" 2>/dev/null | grep NEEDED || true
