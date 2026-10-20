// MTAPI_HARD_RESET_76: self-destroying SW
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(self.registration.unregister());
  e.waitUntil(clients.claim());
});
