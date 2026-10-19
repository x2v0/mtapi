#!/usr/bin/env bash
cd ~/dwn/mtapi
mkdir -p ~/tmp
export TMPDIR=~/tmp
set -euo pipefail

mkdir -p client/dist
for arch in arm64 arm; do
    echo "building android/$arch"
    ( cd client && GOOS=android GOARCH=$arch CGO_ENABLED=0 \
        go build -ldflags="-s -w" -o dist/mtapi-android-$arch . )
done
echo "building linux/amd64 (host, for testing)"
( cd client && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
    go build -ldflags="-s -w" -o dist/mtapi-linux-amd64 . )
echo "client binaries -> client/dist/"
