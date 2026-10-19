#!/usr/bin/env bash
cd ~/dwn/mtapi
mkdir -p ~/tmp
export TMPDIR=~/tmp
set -euo pipefail

if [ ! -f android/app/libs/mobile.aar ]; then
    echo "ERROR: android/app/libs/mobile.aar missing - run scripts/build_aar.sh first"
    exit 1
fi

if [ ! -f android/local.properties ]; then
    if [ -n "${ANDROID_HOME:-}" ]; then
        echo "sdk.dir=$ANDROID_HOME" > android/local.properties
    elif [ -n "${ANDROID_SDK_ROOT:-}" ]; then
        echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties
    else
        echo "ERROR: set ANDROID_HOME or create android/local.properties"
        exit 1
    fi
fi

cd android
./gradlew :app:assembleDebug
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
