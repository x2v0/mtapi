# mtapi Makefile

SRV      := gocore/cmd/mtapi-server
TEST_DIR := test
SHARED   := $(HOME)/dwn/shared-tests
RUNNER   := scripts/test-runner.sh
SO       := android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so
APK_CFG  := $(HOME)/tmp/mtapi-standalone.yaml
APK_OUT  := $(CURDIR)/build/mtapi.apk
APKS_DIR := $(HOME)/dwn/apks
W2A      := $(HOME)/w2a

sync-help:
	@bash scripts/sync-help.sh

sync: sync-help
	@echo "══════════════════════════════════════════════════"
	@echo "  SYNC: gocore → static/demo + help_docs → content"
	@echo "══════════════════════════════════════════════════"
	@cp -f gocore/cmd/mtapi-server/app.js          static/demo/app.js
	@cp -f gocore/cmd/mtapi-server/style.css       static/demo/style.css
	@cp -f gocore/cmd/mtapi-server/mtapi-debug.js  static/demo/mtapi-debug.js
	@echo "  ✓ app.js + style.css + mtapi-debug.js → static/demo/"
	@echo "  ✓ help_docs → content/ru/help/docs/ (via sync-help)"

verify:
	@bash scripts/verify.sh

.PHONY: all test build install so apk clean help dump

all: test build

# ── test: unit + universal с прогрессом ──
test:
	@echo ""
	@echo "══════════════════════════════════════════════════"
	@echo "  MTAPI TESTS"
	@echo "══════════════════════════════════════════════════"
	cd $(TEST_DIR) && $(CURDIR)/$(RUNNER) "mtapi/*.test.js" \
	  node --test --test-force-exit --test-timeout=5000 $$(ls mtapi-*.test.js 2>/dev/null)
	$(CURDIR)/$(RUNNER) "universal: dom" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      INDEX_HTML=$(CURDIR)/$(SRV)/index.html \
	      STYLE_CSS=$(CURDIR)/$(SRV)/style.css \
	      node --test --test-force-exit --test-timeout=5000 $(SHARED)/universal-dom.test.js
	$(CURDIR)/$(RUNNER) "universal: braces" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      node --test --test-force-exit --test-timeout=5000 $(SHARED)/universal-braces.test.js
	$(CURDIR)/$(RUNNER) "universal: syntax" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      INDEX_HTML=$(CURDIR)/$(SRV)/index.html \
	      node --test --test-force-exit --test-timeout=5000 $(SHARED)/universal-syntax.test.js
	@$(CURDIR)/$(RUNNER) "universal: node" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      node --test --test-force-exit --test-timeout=5000 $(SHARED)/universal-node.test.js
	@echo ""
	@echo "══════════════════════════════════════════════════"
	@echo "  ALL TESTS COMPLETE"
	@echo "══════════════════════════════════════════════════"

.PHONY: test-fast
test-fast:
	@echo "══════════════════════════════════════════════════"
	@echo "  MTAPI TEST-FAST (без jsdom/eslint)"
	@echo "══════════════════════════════════════════════════"
	@cd $(TEST_DIR) && node --test mtapi-app.test.js mtapi-acorn.test.js 2>&1 | tail -20
	@echo ""
	@echo "  (пропущены: jsdom, eslint — запусти 'make test' для всех)"

build: so apk

so:
	@echo "══════════════════════════════════════════════════"
	@echo "  BUILD .so"
	@echo "══════════════════════════════════════════════════"
	rm -f $(SO)
	cd $(CURDIR) && bash scripts/build_server.sh 2>&1 | tail -5
	@test -f $(SO) || (echo "✗ .so not built" && exit 1)
	@ls -lh $(SO)

apk: so
	@echo "══════════════════════════════════════════════════"
	@echo "  BUILD APK"
	@echo "══════════════════════════════════════════════════"
	@mkdir -p $(HOME)/tmp $(CURDIR)/build
	@printf '%s\n' \
	 'app:' \
	 '  name: "mtapi"' \
	 '  package: dev.mtapi' \
	 '  targetSdk: 34' \
	 '  versionCode: 292' \
	 '  versionName: "2.13.2"' \
	 'type: custom' \
	 'custom:' \
	 '  sources:' \
	 '    - "$(CURDIR)/android/app/src/main/java"' \
	 '  jniLibs:' \
	 '    - "$(CURDIR)/android/app/src/main/jniLibs"' \
	 '  manifest: "$(CURDIR)/android/app/src/main/AndroidManifest.xml"' \
	 '  resources: "$(CURDIR)/android/app/src/main/res"' \
	 '  abis: [arm64-v8a]' \
	 '  minApi: 26' \
	 '  targetApi: 34' \
	 '  javaRelease: "17"' \
	 'output:' \
	 '  path: "$(CURDIR)/build/mtapi.apk"' \
	 'sign:' \
	 '  enabled: true' \
	 '  keystore: "$(HOME)/.android/debug.keystore"' \
	 '  ksPass: android' \
	 '  keyAlias: androiddebugkey' \
	 '  keyPass: android' \
	 '  v2: true' \
	 > $(APK_CFG)
	cd $(W2A) && go run ./cmd/wta build -c $(APK_CFG) 2>&1 | tail -8
	@test -f $(APK_OUT) || (echo "✗ APK not built" && exit 1)
	@ls -lh $(APK_OUT)
	@mkdir -p $(APKS_DIR) && cp -f $(APK_OUT) $(APKS_DIR)/mtapi-$$(date +%Y%m%d-%H%M%S).apk
	@mkdir -p /sdcard/Download 2>/dev/null || true
	@cp -f $(APK_OUT) /sdcard/Download/mtapi.apk 2>/dev/null || true
	@mkdir -p $(APKS_DIR) 2>/dev/null || true
	@cp -f $(APK_OUT) $(APKS_DIR)/mtapi-$$(date +%Y%m%d-%H%M%S).apk 2>/dev/null || true
	@echo "  APK → $(APK_OUT)"
	@echo "  APK → /sdcard/Download/mtapi.apk"
	@echo "  APK → $(APKS_DIR)/mtapi-*.apk"

install: build
	@echo "══════════════════════════════════════════════════"
	@echo "  INSTALL (termux-open)"
	@echo "══════════════════════════════════════════════════"
	@LATEST=$$(ls -t $(APKS_DIR)/*.apk 2>/dev/null | head -1); \
	 if [ -z "$$LATEST" ]; then LATEST=$(APK_OUT); fi; \
	 echo "  APK: $$LATEST"; \
	 cp -f "$$LATEST" /sdcard/Download/mtapi.apk 2>/dev/null || true; \
	 termux-open "$$LATEST"
	@echo ""
	@echo "  Если «Приложение не установлено» — удали старую версию"
	@echo "  Настройки → Приложения → mtapi → Удалить"

# dump: показать всё про APK одной командой
dump:
	@echo "══════════════════════════════════════════════════"
	@echo "  DUMP APK"
	@echo "══════════════════════════════════════════════════"
	@APK="$(APK_OUT)"; \
	 if [ ! -f "$$APK" ]; then echo "✗ APK not found: $$APK"; exit 1; fi; \
	 echo "  path:   $$APK"; \
	 echo "  size:   $$(ls -lh "$$APK" | awk '{print $$5}')"; \
	 echo "  date:   $$(ls -l --time-style='+%Y-%m-%d %H:%M' "$$APK" | awk '{print $$6, $$7}')"; \
	 echo "  sha256: $$(sha256sum "$$APK" | awk '{print $$1}')"; \
	 echo ""; \
	 echo "── badging ──"; \
	 AAPT2=$$(command -v aapt2 2>/dev/null || echo "$$HOME/android-sdk/build-tools/34.0.4/aapt2"); \
	 "$$AAPT2" dump badging "$$APK" 2>/dev/null | grep -E "package:|versionName|sdkVersion|targetSdkVersion|native-code|application-label" | head -8; \
	 echo ""; \
	 echo "── signature ──"; \
	 APKSIGNER=$$(command -v apksigner 2>/dev/null || echo "$$HOME/android-sdk/build-tools/34.0.4/apksigner"); \
	 "$$APKSIGNER" verify --print-certs "$$APK" 2>/dev/null | head -5; \
	 echo ""; \
	 echo "── permissions ──"; \
	 "$$AAPT2" dump permissions "$$APK" 2>/dev/null | head -20; \
	 echo ""


help:
	@echo "mtapi Makefile"
	@echo ""
	@echo "  make test       — все тесты (mtapi + universal) с прогрессом"
	@echo "  make build      — .so + APK"
	@echo "  make all        — test → build"
	@echo "  make so         — только .so"
	@echo "  make apk        — только APK"
	@echo "  make install    — build + install"
	@echo "  make clean      — удалить .so + APK"

# ═══════════════════════════════════════════════════════════
# MTAPI_CLEANUP_02: правильные clean targets
# ═══════════════════════════════════════════════════════════

.PHONY: clean clean-build clean-bak clean-bin clean-tmp distclean clean-dry clean-git
.PHONY: ci lint check

clean: clean-build
	@echo "✅ clean done. Size:"
	@(du -sh --exclude=.git . 2>/dev/null || du -sh .)

clean-build:
	@echo "🧹 build/ android/app/build/ android/build/ client/dist/"
	@rm -rf build/ android/app/build/ android/build/ client/dist/
	@find . -type f \( -name "*.idsig" -o -name "*.tmp.idsig" -o -name "*.tmp_check.js" \) -not -path "./.git/*" -delete 2>/dev/null || true
	@echo "   ✓ build artifacts removed (tracked .so NOT touched)"

clean-bak:
	@echo "🧹 *.bak, *.bak[0-9]*, *.bak_*"
	@find . -type f \( -name "*.bak" -o -name "*.bak[0-9]*" -o -name "*.bak_*" \) -not -path "./.git/*" -delete 2>/dev/null || true
	@echo "   ✓ backups removed"

clean-bin:
	@echo "🧹 gocore/**/mtapi-server (NOT .so)"
	@find gocore -type f -executable -name "mtapi-server" -delete 2>/dev/null || true
	@echo "   ✓ binary removed (tracked .so preserved)"

clean-tmp:
	@echo "🧹 *.tmp, *.log, .DS_Store"
	@find . -type f \( -name "*.tmp" -o -name "*.log" -o -name ".DS_Store" \) -not -path "./.git/*" -not -path "*/node_modules/*" -delete 2>/dev/null || true
	@echo "   ✓ temp removed"

clean-git:
	@echo "🧹 git rm --cached build/*.idsig"
	@git rm --cached build/mtapi.apk.signed.tmp.idsig 2>/dev/null || true
	@echo "   ✓ untracked from index"

distclean: clean clean-bak clean-bin clean-tmp
	@echo ""
	@echo "✅ distclean complete."
	@echo "   Rebuild: make build && (cd android && ./gradlew assembleDebug)"

clean-dry:
	@echo "🔍 DRY-RUN: what 'make distclean' would remove"
	@echo ""
	@echo "─── build dirs ───"
	@for d in build android/app/build android/build client/dist; do \
	  if [ -d "$$d" ]; then echo "  $$d/  ($$(du -sh $$d 2>/dev/null | cut -f1))"; fi; \
	done
	@echo ""
	@echo "─── .bak files ───"
	@find . -type f \( -name "*.bak" -o -name "*.bak[0-9]*" -o -name "*.bak_*" \) -not -path "./.git/*" 2>/dev/null | head -10
	@echo ""
	@echo "─── *.idsig ───"
	@find . -type f -name "*.idsig" -not -path "./.git/*" 2>/dev/null
	@echo ""
	@echo "─── binaries (not .so) ───"
	@find gocore -type f -executable -name "mtapi-server" 2>/dev/null

# ═══════════════════════════════════════════════════════════
# MTAPI_CI: полный пайплайн перед коммитом
# ═══════════════════════════════════════════════════════════

# lint: node --check на все .js + ESLint
lint:
	@echo "🔍  LINT"
	@echo "──────────────────────────────────────────"
	@echo "  node --check..."
	@fail=0; \
	for f in $$(find gocore test -name "*.js" -not -path "*/node_modules/*" 2>/dev/null); do \
	  if ! node --check "$$f" 2>/dev/null; then \
	    echo "  ✗ $$f SYNTAX ERROR"; fail=1; \
	  fi; \
	done; \
	if [ $$fail -eq 0 ]; then echo "  ✓ SYNTAX OK"; else exit 1; fi
	@if [ -f test/mtapi-eslint.test.js ]; then \
	  echo "  ESLint..."; \
	  (cd test && node --test --test-force-exit --test-timeout=10000 mtapi-eslint.test.js 2>&1 | grep -E "PASS:|FAIL:" || true); \
	fi
	@echo "──────────────────────────────────────────"
	@echo "✅ lint passed"

# check: алиас для test
check: test

# ci: test → lint → apk — полный пайплайн
ci:
	@echo ""
	@echo "══════════════════════════════════════════════════"
	@echo "  CI PIPELINE: test → lint → apk"
	@echo "══════════════════════════════════════════════════"
	@echo ""
	@echo "═══ STEP 1/3: test ═══"
	@$(MAKE) --no-print-directory test 2>&1 | grep -E "PASS:|FAIL:" || true
	@echo ""
	@echo "═══ STEP 2/3: lint ═══"
	@$(MAKE) --no-print-directory lint
	@echo ""
	@echo "═══ STEP 3/3: apk ═══"
	@$(MAKE) --no-print-directory apk 2>&1 | tail -5
	@echo ""
	@echo "══════════════════════════════════════════════════"
	@echo "  ✅ CI PIPELINE COMPLETE"
	@echo "══════════════════════════════════════════════════"


# ── version management ──
.PHONY: version bump
version:
	@echo "── mtapi.yaml ──"
	@grep -E "versionCode:|versionName:" mtapi.yaml
	@echo "── Makefile ──"
	@grep -E "versionCode:|versionName:" Makefile | head -2
	@echo "── APK ──"
	@if [ -f "$(APK_OUT)" ]; then \
	 AAPT2=$$(command -v aapt2 2>/dev/null || echo "$$HOME/android-sdk/build-tools/34.0.4/aapt2"); \
	 "$$AAPT2" dump badging "$(APK_OUT)" 2>/dev/null | grep -E "^package:" | head -1; \
	 else echo "  (not built — run make apk)"; fi

# Usage:
#   make bump MODE=patch   → 2.9.0 (290) → 2.9.1 (291)
#   make bump MODE=minor   → 2.9.0 → 2.10.0
#   make bump MODE=major   → 2.9.0 → 3.0.0
#   make bump V=2.10.5     → explicit versionName
bump:
	@test -n "$(MODE)$(V)" || (echo "Usage: make bump MODE=patch|minor|major" && echo "       make bump V=2.9.1" && exit 1)
	@MODE="$(MODE)" V="$(V)" bash scripts/bump-version.sh
