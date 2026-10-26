---
title: "JS Console"
weight: 110
bookToc: false
---

# 🖥️ JS Console

> Введи в Console Eval (FAB 🐞 → Console), нажми Run (или Ctrl+Enter).

## DOM query

| Command | Description |
|---|---|
| `$("#main")` | document.querySelector |
| `$$("details")` | array of elements |
| `$$("details").length` | count |
| `$$("button").map(b => b.id)` | map over nodes |
| `$("h1").textContent` | text |

## Inspect / Select

| Command | Description |
|---|---|
| `inspect($("#main"))` | highlight + show in info panel |
| `inspect(document.body)` | inspect body |
| `domInspect()` | toggle select mode |
| `domInspectStop()` | exit select mode |
| `domShowFloating()` | open floating DOM tree |
| `_domRefresh()` | refresh tree |
| `_domToggleRoot()` | overlay <-> page |

## JS Logs

| Command | Description |
|---|---|
| `log("test", 123, {a: 1})` | push to JS Logs (V) |
| `warn("careful")` | push (W) |
| `error("oops")` | push (E) |
| `MtapiDebug.buffer().length` | JS logs count |
| `MtapiDebug.errors()` | persistent errors array |
| `clearEval()` | clear output |

## Debug tabs

| Command | Description |
|---|---|
| `MtapiDebug.open()` | open overlay |
| `MtapiDebug.close()` | close overlay |
| `MtapiDebug.setTab("logs")` | switch to Logs |
| `MtapiDebug.setTab("console")` | Console Eval |
| `MtapiDebug.setTab("errors")` | Errors |
| `MtapiDebug.setTab("logcat")` | Logcat |
| `MtapiDebug.setTab("devtools")` | DevTools |
| `MtapiDebug.setTab("system")` | System |
| `MtapiDebug.setTab("network")` | Network |

## Perf

| Command | Description |
|---|---|
| `MtapiDebug.perf("my-test", 42)` | record perf metric |
| `MtapiDebug.time("x")` | start timer |
| `MtapiDebug.timeEnd("x")` | end timer + record |
| `MtapiDebug.selectElement("#main h1")` | select + inspect |

## Network (logged)

| Command | Description |
|---|---|
| `fetch("/ping").then(r => r.json()).then(j => log(j))` | GET /ping |
| `fetch("/battery").then(r => r.json()).then(j => log(j))` | GET /battery |
| `fetch("/system").then(r => r.json()).then(j => log(j))` | GET /system |
| `fetch("/sensors").then(r => r.json()).then(j => log(j))` | GET /sensors |

## Native (APK only)

| Command | Description |
|---|---|
| `Android.getLogcat(20)` | logcat (20 lines) |
| `Android.processList()` | running processes |
| `Android.getDeviceInfo()` | device info |

## Browser overlay

| Command | Description |
|---|---|
| `_browserOpen()` | open (default /help) |
| `_browserOpen("https://example.com")` | open URL |
| `_browserNavigate("https://example.com")` | navigate |
| `_browserClose()` | close |

## AI Snap (advanced)

| Command | Description |
|---|---|
| `inspect($("#main"))` | select first |
| `_aiSnap()` | markdown of selected |
| `_aiSnapWithRequest("make it red")` | markdown + task |
| `_captureElement()` | copy outerHTML |

## Help levels

| Command | Description |
|---|---|
| `?` | quick (5-7) |
| `??` | cheatsheet (all) |
| `???` | full (examples + navigation) |
| `help()` | same as ? |
