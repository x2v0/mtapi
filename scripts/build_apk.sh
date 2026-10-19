#!/usr/bin/env bash
cd ~/dwn/mtapi
set -euo pipefail

[ -f scripts/env.sh ] && source scripts/env.sh
mkdir -p ~/tmp
export TMPDIR=~/tmp

if [ ! -f android/app/libs/mobile.aar ]; then
    echo "ERROR: android/app/libs/mobile.aar missing - run scripts/build_aar.sh first"
    exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
    echo "ERROR: ANDROID_HOME not set (run `bash scripts/setup_w2a.sh`)"
    exit 1
fi
if [ -z "${JAVA_HOME:-}" ] && ! command -v javac >/dev/null; then
    echo "ERROR: no JDK (JAVA_HOME empty and javac not in PATH)"
    exit 1
fi

# (re)write local.properties to be sure
{
    echo "sdk.dir=$ANDROID_HOME"
    [ -n "${ANDROID_NDK_HOME:-}" ] && echo "ndk.dir=$ANDROID_NDK_HOME"
} > android/local.properties

cd android
./gradlew :app:assembleDebug
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
