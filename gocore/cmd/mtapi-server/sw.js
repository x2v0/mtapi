// MTAPI_HARD_RESET_77: self-destroying SW (hard reset)
// Цель: если этот SW установился — полностью разрегистрироваться и очистить кэши.
// Не перехватывает fetch. Не claim'ит клиентов (не нужен контроль — SW умирает).

const SW_VERSION = '77';

self.addEventListener('install', (e) => {
  // skipWaiting ОБЯЗАТЕЛЬНО через waitUntil, иначе браузер не ждёт
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      // 1. Полный hard reset: удалить ВСЕ кэши, созданные прошлыми версиями SW
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (err) {
      // caches может быть недоступен — не критично
      console.warn('[mtapi sw] caches cleanup failed:', err && err.message);
    }

    try {
      // 2. Разрегистрировать сам себя
      const reg = self.registration || (e.target && e.target.registration);
      if (reg) await reg.unregister();
    } catch (err) {
      console.warn('[mtapi sw] unregister failed:', err && err.message);
    }

    // 3. НЕ вызываем clients.claim() — SW умирает, контролировать клиентов незачем.
    //    (claim() + unregister() = клиенты остаются под мёртвым SW до перезагрузки)
  })());
});

// Ручной kill через postMessage — на случай, если SW застрял
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'unregister') {
    self.registration.unregister().catch(() => {});
  }
});

console.log('[mtapi sw] MTAPI_HARD_RESET_77 loaded v' + SW_VERSION);
