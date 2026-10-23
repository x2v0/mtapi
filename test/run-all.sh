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
  # Full output to log + capture node exit code.
  # Do NOT tail-trim: CI needs all failures visible.
  node --test --test-reporter=spec mtapi-*.test.js
  return $?
}

section "mtapi: all *.test.js"  run_all_tests

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
