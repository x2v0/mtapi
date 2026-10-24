#!/usr/bin/env bash
# Bump mtapi version in mtapi.yaml + Makefile.
# Usage:
#   MODE=patch bash scripts/bump-version.sh
#   MODE=minor bash scripts/bump-version.sh
#   MODE=major bash scripts/bump-version.sh
#   V=2.9.1   bash scripts/bump-version.sh
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${MODE:-}" V="${V:-}" python3 << 'PYEOF'
import pathlib, re, sys, os

mode = os.environ.get('MODE', '')
ver  = os.environ.get('V', '')

yaml = pathlib.Path('mtapi.yaml')
mk   = pathlib.Path('Makefile')
if not yaml.exists() or not mk.exists():
    sys.exit('ERROR: mtapi.yaml or Makefile not found (run from repo root)')

ys = yaml.read_text()
ms = mk.read_text()

m_code = re.search(r'versionCode:\s*(\d+)', ys)
m_name = re.search(r'versionName:\s*"([^"]+)"', ys)
if not m_code or not m_name:
    sys.exit('ERROR: cannot parse versionCode/versionName from mtapi.yaml')

cur_code = int(m_code.group(1))
cur_name = m_name.group(1)

if ver:
    new_name = ver
elif mode == 'patch':
    parts = cur_name.split('.')
    new_name = f"{parts[0]}.{parts[1]}.{int(parts[2]) + 1}"
elif mode == 'minor':
    parts = cur_name.split('.')
    new_name = f"{parts[0]}.{int(parts[1]) + 1}.0"
elif mode == 'major':
    parts = cur_name.split('.')
    new_name = f"{int(parts[0]) + 1}.0.0"
else:
    sys.exit('ERROR: set MODE=patch|minor|major OR V=X.Y.Z')

new_code = cur_code + 1

ys = re.sub(r'versionCode:\s*\d+', f'versionCode: {new_code}', ys, count=1)
ys = re.sub(r'versionName:\s*"[^"]*"', f'versionName: "{new_name}"', ys, count=1)
yaml.write_text(ys)

ms = re.sub(r"versionCode: \d+", f"versionCode: {new_code}", ms, count=1)
ms = re.sub(r'versionName: "[^"]*"', f'versionName: "{new_name}"', ms, count=1)
mk.write_text(ms)

print(f'✓ {cur_name} ({cur_code}) → {new_name} ({new_code})')
PYEOF
