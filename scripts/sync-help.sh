#!/usr/bin/env bash
# Copy help docs from Go source -> Hugo content (before hugo build)
# Source of truth: gocore/cmd/mtapi-server/help_docs/*.md
# Target:          content/ru/help/docs/*.md (gitignored)
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="gocore/cmd/mtapi-server/help_docs"
DST="content/ru/help/docs"

mkdir -p "$DST"
rm -f "$DST"/*.md
cp -p "$SRC"/*.md "$DST"/

echo "  ✓ synced $(ls "$SRC"/*.md | wc -l) md files: $SRC -> $DST"
