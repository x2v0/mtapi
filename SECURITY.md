# Security Policy

## Поддерживаемые версии

| Версия | Поддержка |
|--------|-----------|
| `2.1.x` (security audit A+B+C+D) | ✅ активная |
| `2.0.x` | ⚠️ только critical fixes |
| `< 2.0` | ❌ не поддерживается |

## Как сообщить об уязвимости

**Не открывай публичный issue.** Используй один из каналов:

1. **GitHub Private Vulnerability Reporting** (рекомендую):
   https://github.com/x2v0/mtapi/security/advisories/new

2. **Email:** `valeriy.onuchin@ya.ru`

В сообщении укажи:
- Версию (`git rev-parse --short HEAD` или тег)
- Компонент (mtapi / w2a)
- Шаги воспроизведения
- Ожидаемое / фактическое поведение
- Impact (что может злоумышленник)

**Не присылай:** реальные токены, keystore, личные данные. Заменяй на `REDACTED`.

## Что мы делаем

- **Ответ:** в течение 72 часов
- **Оценка severity:** CVSS + наш контекст
- **Fix:** в течение 30 дней для Critical/High, 90 дней для Medium
- **Публичное раскрытие:** после выхода fix + 14 дней

## Вне scope

Следующие категории **не считаются уязвимостями** в mtapi:

- **Приложения с 18 permissions в Play Store** — mtapi не для Play Store (см. README)
- **Shizuku / root** — не требуются и не поддерживаются
- **XSS через API-данные** — все данные экранируются (`esc()` в `app.js`); если найдёшь конкретный путь — присылай
- **CSRF с другого origin** — CORS ограничен `127.0.0.1:7788`, `/restart` требует Bearer
- **`?token=` в URL** — осознанное решение для локального дашборда (same-origin)
- **Отсутствие V2/V3 APK signer в w2a** — C-5, известная проблема (см. release notes)
- **Rate limit на `/call`** — не реализован, только на `/sms`
- **DoS через `cameraPhoto`/`microphoneRecord`** — требуют auth, per-method timeouts есть

## Модель угроз

**Защищено:**
- Доступ к API — Bearer token (constant-time)
- Path traversal в файловых операциях — canonical path check
- SSRF в `netFetch` — RFC1918 блоклист
- Утечка секретов в logcat — токен/clipboard/sensor/location не логируются
- SMS-бомба — rate limit 30s / 1000 chars
- Install APK — только из `/sdcard/Download/` и `/data/data/dev.mtapi/`
- WebView — XSS-экранирование, `MIXED_CONTENT_NEVER_ALLOW`

**Не защищено:**
- **Привилегированные API** (другие процессы, system settings) — требуют root/ADB, вне scope
- **Google Play** — 18 permissions = отказ (sideload / F-Droid)
- **V2 signer в w2a** — pending (C-5)
- **Keystore password в w2a** — pending (M-5)
- **Приложения с `addJavascriptInterface`** — дашборд изолирован, XSS не подтверждён, но архитектурный риск

## Известные открытые проблемы

См. [release notes v2.1.0-security](https://github.com/x2v0/mtapi/releases/tag/v2.1.0-security):

- **C-5** — V2 signer в w2a (код есть, не вызывается)
- **M-5** — keystore password в `ps` при `apksigner`

## PGP

Если нужен PGP — запроси публичный ключ в первом письме. Пока используем GitHub Private Advisory.

---

*Последнее обновление: 2026-10-23*
