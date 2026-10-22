# mtapi Makefile

SRV      := gocore/cmd/mtapi-server
TEST_DIR := test
SHARED   := $(HOME)/dwn/shared-tests
RUNNER   := scripts/test-runner.sh
SO       := android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so
APK_CFG  := $(HOME)/tmp/mtapi-standalone.yaml
APK_OUT  := $(CURDIR)/build/mtapi-debug.apk
APKS_DIR := $(HOME)/dwn/apks
W2A      := $(HOME)/w2a

.PHONY: all test build install so apk clean help

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
	 '  targetSdk: 29' \
	 '  versionCode: 1' \
	 '  versionName: "1.6.0"' \
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
	 '  path: "$(CURDIR)/build/mtapi-debug.apk"' \
	 > $(APK_CFG)
	cd $(W2A) && go run ./cmd/wta build -c $(APK_CFG) 2>&1 | tail -8
	@test -f $(APK_OUT) || (echo "✗ APK not built" && exit 1)
	@ls -lh $(APK_OUT)
	@mkdir -p $(APKS_DIR) && cp -f $(APK_OUT) $(APKS_DIR)/mtapi-$$(date +%Y%m%d-%H%M%S).apk
	@mkdir -p /sdcard/Download 2>/dev/null || true
	@cp -f $(APK_OUT) /sdcard/Download/mtapi-debug.apk 2>/dev/null || true
	@mkdir -p $(APKS_DIR) 2>/dev/null || true
	@cp -f $(APK_OUT) $(APKS_DIR)/mtapi-$$(date +%Y%m%d-%H%M%S).apk 2>/dev/null || true
	@echo "  APK → $(APK_OUT)"
	@echo "  APK → /sdcard/Download/mtapi-debug.apk"
	@echo "  APK → $(APKS_DIR)/mtapi-*.apk"

install: build
	@echo "══════════════════════════════════════════════════"
	@echo "  INSTALL"
	@echo "══════════════════════════════════════════════════"
	ls -t $(APKS_DIR)/*.apk | head -1 | xargs -I {} cp -f {} /sdcard/Download/mtapi.apk
	rish -c 'am force-stop dev.mtapi' || true
	rish -c 'cp /sdcard/Download/mtapi.apk /data/local/tmp/mtapi.apk'
	rish -c 'pm install -r -t --user 0 /data/local/tmp/mtapi.apk'
	rish -c 'am start -W -n dev.mtapi/.MainActivity'

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
	@git rm --cached build/mtapi-debug.apk.signed.tmp.idsig 2>/dev/null || true
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
