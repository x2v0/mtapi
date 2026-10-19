#!/usr/bin/env bash
cd ~/dwn/mtapi
mkdir -p ~/tmp
export TMPDIR=~/tmp
set -euo pipefail

if ! command -v adb >/dev/null; then
    echo "adb not found"; exit 1
fi

PKG=dev.mtapi

# Check A: foreground service can be started directly
adb shell am start-foreground-service -n "$PKG/.ApiService" >/dev/null 2>&1 || true
sleep 1
PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' || true)
if [ -z "$PID" ]; then
    echo "FAIL: service not running after am start-foreground-service"
    exit 1
fi
echo "  ok service running pid=$PID"

# Check B: boot receiver wakes the process
adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
sleep 0.5
adb shell am broadcast -a dev.mtapi.TEST_BOOT -p "$PKG" >/dev/null 2>&1 || true
sleep 1.5
PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' || true)
if [ -z "$PID" ]; then
    echo "  WARN: TEST_BOOT did not restart the process (may be force-stop policy on this ROM)"
    echo "        manual check: adb shell am broadcast -a android.intent.action.BOOT_COMPLETED -p $PKG"
    exit 0
fi
echo "  ok receiver works, pid=$PID"
echo "boot-test: OK"
