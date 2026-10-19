# mtapi — build / test / verify
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Termux: /tmp does not exist. Redirect all temp files to $HOME/tmp.
export TMPDIR := $(HOME)/tmp

GO ?= go

.PHONY: help all aar apk client test test-go integration grpc-e2e verify fmt vet clean git-commit tmp install boot-test devserver

help:
	@echo "mtapi targets:"
	@echo "  make all          aar + apk + client"
	@echo "  make aar          android/app/libs/mobile.aar via gomobile"
	@echo "  make apk          debug apk (needs aar + Android SDK)"
	@echo "  make client       cross-build Go client binaries"
	@echo "  make test         go unit + verify + integration"
	@echo "  make test-go      go test ./... in gocore + client"
	@echo "  make integration  e2e: Go mock JSON server + client binary"
	@echo "  make verify       Go tool: check file layout of repo"
	@echo "  make fmt vet      go fmt / go vet"
	@echo "  make clean        remove build artifacts"
	@echo "  make git-commit   git add -A && commit (needs MSG=...)"
	@echo "  make install      adb install -r the debug APK + launch"
	@echo "  make tmp          ensure $$TMPDIR exists"
	@echo "  make boot-test    adb-based BOOT_COMPLETED / receiver check"

tmp:
	@mkdir -p $(TMPDIR)
	@echo "TMPDIR=$(TMPDIR)"

all: aar apk client

aar: tmp
	bash scripts/build_aar.sh

apk: tmp
	bash scripts/build_apk.sh

client: tmp
	bash scripts/build_client.sh

test: test-go verify integration grpc-e2e

test-go: tmp
	cd gocore && $(GO) test ./... -count=1
	cd client && $(GO) test ./... -count=1

verify: tmp
	cd tools && go run ./cmd/verify

integration: client
	cd tools && go run ./cmd/integration

fmt: tmp
	cd gocore && $(GO) fmt ./...
	cd client && $(GO) fmt ./...

vet: tmp
	cd gocore && $(GO) vet ./...
	cd client && $(GO) vet ./...

install:
	@if [ ! -f android/app/build/outputs/apk/debug/app-debug.apk ]; then \
		echo "APK not built — run make apk first"; exit 1; fi
	adb install -r android/app/build/outputs/apk/debug/app-debug.apk
	adb shell am start -n dev.mtapi/.MainActivity

boot-test: tmp
	bash scripts/test_boot.sh

grpc-e2e: client
	cd tools && go run ./cmd/grpce2e

clean:
	rm -rf client/dist
	rm -f  android/app/libs/mobile.aar
	rm -rf android/build android/app/build android/.gradle

git-commit:
	@if [ -z "$(MSG)" ]; then echo "usage: make git-commit MSG=\"message\""; exit 1; fi
	git add -A
	git commit -m "$(MSG)"

devserver:
	cd tools && go run ./cmd/devserver
