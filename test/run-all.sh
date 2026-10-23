#!/data/data/com.termux/files/usr/bin/bash
set -u
cd "$(dirname "$0")"

GREEN='\033[32m'
RED='\033[31m'
BLUE='\033[34m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0

section() {
  local name="$1"
  shift
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${BLUE}  $name${RESET}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════${RESET}"
  if "$@"; then
    PASS=$((PASS+1))
    echo -e "${GREEN}✓ $name${RESET}"
  else
    FAIL=$((FAIL+1))
    echo -e "${RED}✗ $name${RESET}"
  fi
}

run_all_tests() {
  # pipeline: preserve node's exit code (was swallowed by tail)
  node --test mtapi-*.test.js 2>&1 | tail -30
  return "${PIPESTATUS[0]}"
}

section "mtapi: all *.test.js"  run_all_tests

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
