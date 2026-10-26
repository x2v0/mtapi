#!/usr/bin/env bash
# Fast pre-commit verification (no build, no install, no network)
set -uo pipefail
cd "$(dirname "$0")/.."
GOCORE="gocore/cmd/mtapi-server"
DEMO="static/demo"
SO="android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so"
FAIL=0
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$*"; FAIL=$((FAIL+1)); }
hdr()  { printf "\n\033[1m%s\033[0m\n" "$*"; }

hdr "[1/6] JS syntax"
for f in "$GOCORE/app.js" "$GOCORE/mtapi-debug.js" "$DEMO/app.js" "$DEMO/mtapi-debug.js"; do
  [ -f "$f" ] || { fail "$f missing"; continue; }
  node --check "$f" 2>/dev/null && ok "$f" || fail "$f SyntaxError"
done

hdr "[2/6] sync gocore ↔ static/demo"
for f in app.js style.css mtapi-debug.js; do
  cmp -s "$GOCORE/$f" "$DEMO/$f" && ok "$f identical" || fail "$f DIFFERS"
done

hdr "[3/6] CSS braces"
for f in "$GOCORE/style.css" "$DEMO/style.css"; do
  o=$(grep -o '{' "$f" | wc -l); c=$(grep -o '}' "$f" | wc -l)
  [ "$o" = "$c" ] && ok "$f ($o/$c)" || fail "$f unbalanced ($o/$c)"
done

hdr "[4/6] demo index.html"
# positive checks (regex — supports ?v=YYYYMMDD cache-busting)
check_re() { # label pattern
  if grep -qE "$2" "$DEMO/index.html" 2>/dev/null; then ok "has: $1"; else fail "missing: $1"; fi
}
check_re 'mock-backend.js'    '\./mock-backend\.js'
check_re 'TOKEN="DEMO"'       'var TOKEN="DEMO"'
check_re './style.css(?v=)'   'href="\./style\.css(\?v=[a-z0-9]+)?"'
check_re './app.js(?v=)'      'src="\./app\.js(\?v=[a-z0-9]+)?"'
check_re './mtapi-debug.js(?v=)' 'src="\./mtapi-debug\.js(\?v=[a-z0-9]+)?"'
check_re 'DEMO banner'        'DEMO — mock Android data'
check_re '<a class="demo-back"' '<a class="demo-back"'
# negative: no leaked absolute paths / placeholder
for b in '{{TOKEN}}' 'href="/style\.css' 'src="/app\.js"'; do
  if grep -qE "$b" "$DEMO/index.html" 2>/dev/null; then fail "leaked: $b"; else ok "no: $b"; fi
done

hdr "[5/6] markers"
check() { grep -qF "$2" "$1" 2>/dev/null && ok "$3" || fail "$3 (missing '$2' in $1)"; }
check "$GOCORE/index.html"    'id="help-btn"'           'help-btn in header'
check "$GOCORE/index.html"    'id="theme"'              'theme-btn in header'
check "$GOCORE/mtapi-debug.js" '_helpModeToggle'        'help-mode toggle'
check "$GOCORE/mtapi-debug.js" '_helpIntroShow'         'help intro modal'
check "$GOCORE/mtapi-debug.js" 'TAB_INFO'               'TAB_INFO wiki'
check "$GOCORE/mtapi-debug.js" 'LOG_LEVEL_INFO'         'LOG_LEVEL_INFO wiki'
check "$GOCORE/app.js"         'EP_INFO'                'EP_INFO endpoints'
check "$GOCORE/style.css"      'body.help-mode::before' 'help-mode overlay'
check "$GOCORE/style.css"      '#mtapi-help-intro'      'intro modal CSS'
check "$GOCORE/style.css"      '#browser-btn:disabled'  'browser disabled CSS'
check "$GOCORE/style.css"      '[data-tip]'             'tooltip CSS'

# help refactor (Stage 2): md embedded + goldmark
check "$GOCORE/help_embed.go"          'go:embed help_docs/*.md'     'go:embed help_docs'
check "$GOCORE/help_embed.go"          'renderHelpDoc'               'renderHelpDoc'
check "$GOCORE/help_pages.go"          'renderHelpDoc("quickstart")' 'help_pages uses renderHelpDoc'
check "$GOCORE/help_docs/api.md"       '/battery'                     'api.md has /battery'
check "$GOCORE/help_docs/js_console.md" 'MtapiDebug'                  'js_console.md has MtapiDebug'
check "gocore/go.mod"                   'yuin/goldmark'               'goldmark in go.mod'

hdr "[6/6] .so"
if [ -f "$SO" ]; then
  sz=$(stat -c%s "$SO" 2>/dev/null || stat -f%z "$SO")
  mb=$((sz / 1024 / 1024))
  [ "$mb" -ge 5 ] && ok ".so size: ${mb} MB" || fail ".so too small: ${mb} MB"
  for m in '_helpModeToggle' 'TAB_INFO' 'EP_INFO' 'id="help-btn"' 'mtapi-help-intro'; do
    if strings "$SO" 2>/dev/null | grep -F "$m" > /dev/null; then ok ".so has: $m"; else fail ".so missing: $m"; fi
  done
else
  fail ".so not found: $SO"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  printf "\033[32m╔══════════════════════════════════════╗\033[0m\n"
  printf "\033[32m║  VERIFY OK — ready to commit         ║\033[0m\n"
  printf "\033[32m╚══════════════════════════════════════╝\033[0m\n"
  exit 0
else
  printf "\033[31m╔══════════════════════════════════════╗\033[0m\n"
  printf "\033[31m║  VERIFY FAIL — %d problem(s)          ║\033[0m\n" "$FAIL"
  printf "\033[31m╚══════════════════════════════════════╝\033[0m\n"
  exit 1
fi
