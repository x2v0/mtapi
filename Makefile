# mtapi — build targets
SHELL := /bin/bash
export TMPDIR := $(HOME)/tmp

.PHONY: help server apk install grant verify live cli all clean

help:
	@echo "mtapi targets:"
	@echo "  make server   build Go binary (libmtapi-server.so)"
	@echo "  make apk      build APK via w2a"
	@echo "  make install  install via rish (fallback termux-open)"
	@echo "  make grant    grant Android permissions via rish"
	@echo "  make verify   static file checks"
	@echo "  make live     live endpoints test (ping, battery, ...)"
	@echo "  make cli      install ~/bin/mtapi"
	@echo "  make all      apk + install + grant + cli"
	@echo "  make clean    remove build artifacts"

server:
	bash scripts/build_server.sh

apk: server
	cd ~/w2a && go run ./cmd/wta build -c ~/mtapi/mtapi.yaml

install: apk
	bash scripts/install.sh

grant:
	@for p in READ_CONTACTS READ_CALL_LOG READ_SMS SEND_SMS \
	          ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION CAMERA \
	          POST_NOTIFICATIONS READ_PHONE_STATE RECORD_AUDIO \
	          BLUETOOTH_CONNECT BLUETOOTH_SCAN; do \
	    rish -c "pm grant dev.mtapi android.permission.$$p" 2>/dev/null || true; \
	done
	@echo "permissions granted"

cli:
	mkdir -p ~/bin
	cp bin/mtapi ~/bin/mtapi
	chmod +x ~/bin/mtapi
	@echo "installed ~/bin/mtapi — add ~/bin to PATH"

verify:
	@test -f gocore/cmd/mtapi-server/main.go && echo "  ok main.go"
	@test -f gocore/cmd/mtapi-server/http.go && echo "  ok http.go"
	@test -f gocore/cmd/mtapi-server/bridge.go && echo "  ok bridge.go"
	@test -f gocore/cmd/mtapi-server/api.go && echo "  ok api.go"
	@test -f android/app/src/main/java/dev/mtapi/GoServerLauncher.java && echo "  ok GoServerLauncher"
	@test -f android/app/src/main/java/dev/mtapi/JavaBridge.java && echo "  ok JavaBridge"
	@test -f android/app/src/main/java/dev/mtapi/AndroidApiImpl.java && echo "  ok AndroidApiImpl"
	@test -f README.md && echo "  ok README"
	@test -f ARCHITECTURE.md && echo "  ok ARCHITECTURE"
	@test -f CHANGELOG.md && echo "  ok CHANGELOG"
	@test -f bin/mtapi && echo "  ok bin/mtapi"

live:
	@T=$$(cat ~/.config/mtapi/token 2>/dev/null); \
	[ -z "$$T" ] && { echo "no token"; exit 1; }; \
	for p in ping battery device cpu/detail sensors; do \
	  echo "--- /$$p"; \
	  curl -s -m 3 -H "Authorization: Bearer $$T" "http://127.0.0.1:7788/$$p" | head -c 200; \
	  echo; \
	done

all: apk install grant cli
	@echo "mtapi installed"

clean:
	rm -f android/app/src/main/jniLibs/arm64-v8a/libmtapi-server.so
	rm -f android/app/build/outputs/apk/mtapi-debug.apk
	
