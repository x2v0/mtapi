#!/usr/bin/env bash
cd ~/dwn/mtapi
mkdir -p ~/tmp
export TMPDIR=~/tmp
set -uo pipefail

echo "=== APK installed? ==="
pm list packages 2>/dev/null | grep -i mtapi || echo "  NOT installed"

echo
echo "=== process running? ==="
PID=$(pidof dev.mtapi 2>/dev/null || true)
if [ -n "$PID" ]; then echo "  pid=$PID"; else echo "  NOT running"; fi

echo
echo "=== sockets in /proc/net/unix ==="
awk '/mtapi/ {print "  " $0}' /proc/net/unix || echo "  no @mtapi sockets"

echo
echo "=== last 20 mtapi logcat lines ==="
logcat -d -t 200 2>/dev/null | grep -i mtapi | tail -20 || echo "  (logcat unavailable)"

echo
echo "=== token file ==="
TOK="$(cat ~/.config/mtapi/token 2>/dev/null || true)"
if [ -z "$TOK" ]; then
    echo "  missing ~/.config/mtapi/token"
elif [ "$TOK" = "<paste-token>" ]; then
    echo "  contains placeholder '<paste-token>' — replace with real token"
else
    echo "  set (${#TOK} chars)"
fi
