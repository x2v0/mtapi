// PWA service worker for mtapi dashboard — cache shell, never cache /api
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Only cache root HTML (shell); never cache API data
  if (u.pathname === '/' && e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request).catch(() => new Response('mtapi offline', { status: 503 }))
    );
  }
});
