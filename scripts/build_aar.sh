#!/usr/bin/env bash
cd ~/dwn/mtapi
set -euo pipefail

[ -f scripts/env.sh ] && source scripts/env.sh
mkdir -p ~/tmp
export TMPDIR=~/tmp

if ! command -v gomobile >/dev/null; then
    echo "installing gomobile..."
    go install golang.org/x/mobile/cmd/gomobile@latest
    go install golang.org/x/mobile/cmd/gobind@latest
    export PATH="$PATH:$(go env GOPATH)/bin"
fi

if [ -z "${ANDROID_NDK_HOME:-}" ]; then
    echo "ERROR: ANDROID_NDK_HOME not set (run `bash scripts/setup_w2a.sh`)"
    exit 1
fi

gomobile init
mkdir -p android/app/libs
gomobile bind \
    -target=android/arm64,android/arm \
    -androidapi=26 \
    -javapkg=go.mobile \
    -o android/app/libs/mobile.aar \
    ./gocore/mobile
echo "AAR -> android/app/libs/mobile.aar"
