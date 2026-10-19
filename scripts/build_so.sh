#!/usr/bin/env bash
cd ~/mtapi
set -uo pipefail
mkdir -p ~/tmp
export TMPDIR=~/tmp

WRAPPER=~/dwn/mtapi/scripts/clang-android26.sh
OUT=android/app/src/main/jniLibs/arm64-v8a
ERR=~/tmp/cshared.err
mkdir -p "$OUT"
: > "$ERR"

NDK_PRE="/data/data/com.termux/files/home/ndk/android-ndk-r29/toolchains/llvm/prebuilt/linux-aarch64"
SYS="$NDK_PRE/sysroot"
LIB_UNWIND="$NDK_PRE/lib/clang/21/lib/linux/aarch64"
LIB_SYS26="$SYS/usr/lib/aarch64-linux-android/26"

CGO_LDFLAGS_VALUE="-Wl,-z,max-page-size=16384"
[ -d "$LIB_UNWIND" ] && CGO_LDFLAGS_VALUE="$CGO_LDFLAGS_VALUE -L$LIB_UNWIND"
[ -d "$LIB_SYS26" ]  && CGO_LDFLAGS_VALUE="$CGO_LDFLAGS_VALUE -L$LIB_SYS26"

echo "LDFLAGS = $CGO_LDFLAGS_VALUE"
cd gocore

if CC="$WRAPPER" \
   CGO_ENABLED=1 \
   GOOS=android GOARCH=arm64 \
   CGO_CFLAGS="-O2 -fPIC" \
   CGO_LDFLAGS="$CGO_LDFLAGS_VALUE" \
   go build -buildmode=c-shared -trimpath \
       -tags=android \
       -ldflags="-s -w" \
       -o "../$OUT/libgojni.so" \
       ./jni 2>"$ERR"; then
    echo "c-shared: OK"
else
    echo "c-shared FAILED"
    head -60 "$ERR"
    exit 1
fi

echo
echo "file:"
file "../$OUT/libgojni.so"
echo
echo "symbols:"
nm -D --defined-only "../$OUT/libgojni.so" 2>/dev/null | grep Java_dev_mtapi || echo "  (none)"
echo
echo "max-page alignment (should be 0x4000 = 16384):"
readelf -l "../$OUT/libgojni.so" 2>/dev/null | grep -E 'LOAD' | head -3
echo
echo "deps:"
readelf -d "../$OUT/libgojni.so" 2>/dev/null | grep NEEDED || true
