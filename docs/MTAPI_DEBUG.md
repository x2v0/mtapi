# mtapi-debug.js

Zero-dep mobile DevTools for any WebView (no PC, no VPN).

## Подключение (2 строки)

    <script src="/mtapi-debug.js"></script>
    <script>MtapiDebug.attach({ container: document.body });</script>

## Что даёт

- JS Logs (console.* + stack trace 4 уровня)
- Console Eval (indirect eval + stack)
- Performance (render / reloadLogcat / loadDebugCard)
- Errors persistent (localStorage — выживают reload)
- Network [net] с timing
- Stack trace: window.onerror + unhandledrejection

## API

    MtapiDebug.version  // 0.1.0
    MtapiDebug.buffer() // [{t,lvl,m},...]
    MtapiDebug.errors() // [{t,lvl,m},...]
    MtapiDebug.log(level, ...args)

## Что НЕ делает

- Не отлаживает готовые чужие APK (только свои WebView)
- Не заменяет Chrome DevTools

## Roadmap

- v0.2 Network body capture
- v0.3 DOM inspector (упрощённый)
- v0.4 Event listener tracker
