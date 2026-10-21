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
	  node --test $$(ls mtapi-*.test.js 2>/dev/null)
	$(CURDIR)/$(RUNNER) "universal: dom" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      INDEX_HTML=$(CURDIR)/$(SRV)/index.html \
	      STYLE_CSS=$(CURDIR)/$(SRV)/style.css \
	      node --test $(SHARED)/universal-dom.test.js
	$(CURDIR)/$(RUNNER) "universal: braces" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      node --test $(SHARED)/universal-braces.test.js
	$(CURDIR)/$(RUNNER) "universal: syntax" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      INDEX_HTML=$(CURDIR)/$(SRV)/index.html \
	      node --test $(SHARED)/universal-syntax.test.js
	@$(CURDIR)/$(RUNNER) "universal: node" \
	  env APP_JS=$(CURDIR)/$(SRV)/app.js \
	      node --test $(SHARED)/universal-node.test.js
	@echo ""
	@echo "══════════════════════════════════════════════════"
	@echo "  ALL TESTS COMPLETE"
	@echo "══════════════════════════════════════════════════"

build: so apk

so:
	@echo "══════════════════════════════════════════════════"
	@echo "  BUILD .so"
	@echo "══════════════════════════════════════════════════"
	rm -f $(SO)
	cd $(CURDIR) && bash scripts/build_server.sh 2>&1 | tail -5
	@test -f $(SO) || (echo "✗ .so not built" && exit 1)
	@ls -lh $(SO)

apk:
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

install: build
	@echo "══════════════════════════════════════════════════"
	@echo "  INSTALL"
	@echo "══════════════════════════════════════════════════"
	ls -t $(APKS_DIR)/*.apk | head -1 | xargs -I {} cp -f {} /sdcard/Download/mtapi.apk
	rish -c 'am force-stop dev.mtapi' || true
	rish -c 'cp /sdcard/Download/mtapi.apk /data/local/tmp/mtapi.apk'
	rish -c 'pm install -r -t --user 0 /data/local/tmp/mtapi.apk'
	rish -c 'am start -W -n dev.mtapi/.MainActivity'

clean:
	rm -f $(SO) $(APK_OUT)
	@echo "✓ cleaned"

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
