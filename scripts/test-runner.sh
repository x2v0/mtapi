#!/data/data/com.termux/files/usr/bin/bash
set -u

LABEL="$1"
shift

if [ -z "$LABEL" ] || [ $# -eq 0 ]; then
  echo "usage: $0 <label> <command...>"
  exit 2
fi

GREEN='\033[32m'
RED='\033[31m'
BLUE='\033[34m'
BOLD='\033[1m'
YELLOW='\033[33m'
CYAN='\033[36m'
RESET='\033[0m'

echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${BLUE}║  ${CYAN}${LABEL}${RESET}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${RESET}"

TMP_OUT=$(mktemp)
"$@" 2>&1 | tee "$TMP_OUT" | while IFS= read -r line; do
  if echo "$line" | grep -qE '^\s*(✔|✓)\s+'; then
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//' | head -c 90)
    echo -e "${GREEN}${trimmed}${RESET}"
  elif echo "$line" | grep -qE '^\s*(✖|✗|×)\s+'; then
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//' | head -c 90)
    echo -e "${RED}${trimmed}${RESET}"
  elif echo "$line" | grep -qE 'ℹ (tests|pass|fail)'; then
    echo -e "  ${YELLOW}${line}${RESET}"
  elif echo "$line" | grep -qE 'AssertionError|TypeError|SyntaxError|ReferenceError'; then
    echo -e "  ${RED}${line}${RESET}"
  fi
done

# Счётчики из tee-вывода
PASS=$(grep -cE '^\s*(✔|✓)\s+' "$TMP_OUT" || true)
FAIL=$(grep -cE '^\s*(✖|✗|×)\s+' "$TMP_OUT" || true)
TOTAL=$((PASS + FAIL))

rm -f "$TMP_OUT"

echo -e "${BOLD}──────────────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}PASS: $PASS${RESET}  ${RED}FAIL: $FAIL${RESET}  TOTAL: $TOTAL"
echo -e "${BOLD}──────────────────────────────────────────────────${RESET}"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
