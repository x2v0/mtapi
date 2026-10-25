---
title: "mtapi — Android HTTP bridge"
type: docs
---

# mtapi

**Android HTTP bridge**: 60+ API endpoints через HTTP. Датчики, камера, сеть, debug overlay, browser. **Без root / Shizuku / Termux**. **< 2 MB**. Open source.

{{< hint info >}}
**v2.13.2** · MIT · [GitHub](https://github.com/x2v0/mtapi) · [Releases](https://github.com/x2v0/mtapi/releases/latest) · [Demo](/mtapi/demo/)
{{< /hint >}}

## Быстрый старт

    # 1. Установи APK (Releases → latest)
    # 2. Открой mtapi → WebView → сервер на :7788
    curl http://127.0.0.1:7788/battery?token=YOUR_TOKEN

## Features

| Feature | Описание |
|---|---|
| 60+ endpoints | battery, sensors, camera, network, storage, audio, apps, location |
| Debug overlay | 7 табов: Logs, Console, Errors, Logcat, DevTools, System, Network |
| Browser | iframe + proxy + Android.httpGet |
| Web console | /console — 5 табов, async await, help ? ?? ??? |
| 170 tests | jsdom + source + data-driven, CI 33s |

## Ссылки

- **GitHub**: https://github.com/x2v0/mtapi
- **Releases**: https://github.com/x2v0/mtapi/releases
- **Demo**: /mtapi/demo/
