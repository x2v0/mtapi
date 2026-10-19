#!/data/data/com.termux/files/usr/bin/bash
# Install the built mtapi APK via termux-open.
cd ~/mtapi
set -euo pipefail
mkdir -p ~/tmp
export TMPDIR=~/tmp

APK=android/app/build/outputs/apk/mtapi-debug.apk
if [ ! -f "$APK" ]; then
  echo "APK not found: $APK"
  echo "run: make apk-wta"
  exit 1
fi

DST="$HOME/storage/downloads/mtapi-debug.apk"
if [ -d "/sdcard/Download" ]; then
  DST="/sdcard/Download/mtapi-debug.apk"
fi

echo "cp $APK -> $DST"
cp -f "$APK" "$DST"

echo "opening installer..."
termux-open "$DST"

echo
echo "After install:"
echo "  - open mtapi app, tap 'Copy token'"
echo "  - mkdir -p ~/.config/mtapi"
echo "  - echo '<paste-token>' > ~/.config/mtapi/token"
echo "  - ./client/dist/mtapi-native ping"
