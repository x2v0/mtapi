#!/usr/bin/env bash
cd ~/dwn/mtapi
mkdir -p ~/tmp
export TMPDIR=~/tmp
set -euo pipefail

if ! command -v gomobile >/dev/null; then
    echo "installing gomobile..."
    go install golang.org/x/mobile/cmd/gomobile@latest
    go install golang.org/x/mobile/cmd/gobind@latest
    export PATH="$PATH:$(go env GOPATH)/bin"
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
