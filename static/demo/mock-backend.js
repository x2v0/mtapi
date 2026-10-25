// static/demo/mock-backend.js
// GH Pages demo: mock backend for mtapi (no Android, no Go)
// Intercepts fetch + Android stub. Response shapes match real Go server.
(function() {
  'use strict';

  // ── Android bridge stub ──
  window.Android = window.Android || {
    getLogcat: function() {
      return '12-20 12:34:56.789 1000 1000 I Mtapi: DEMO logcat\n' +
             '12-20 12:34:57.001 1000 1000 D Mtapi: mock line 2\n' +
             '12-20 12:34:57.234 1000 1000 W Mtapi: mock warning\n' +
             '12-20 12:34:58.567 1000 1000 E Mtapi: mock error\n' +
             '12-20 12:34:59.890 1000 1000 V Mtapi: mock verbose';
    },
    processList: function() {
      return 'USER  PID  PPID  NAME\nroot 1 0 init\ndev.mtapi 4321 1 demo';
    },
    getDeviceInfo: function() { return 'DEMO Device (mock)'; },
    httpGet: function() { return '(DEMO: httpGet not available in browser)'; },
    clearLogcat: function() { return 'cleared'; },
  };

  // ── Mock responses ──
  const now = () => new Date().toISOString();
  const ts = () => Date.now();

  const MOCK = {
    // Basic
    '/ping':                       { ok: true, response: 'pong' },
    '/battery':                    { ok: true, data: { percentage: 92, charging: false } },
    '/battery/detailed':           { ok: true, data: { percentage: 92, charging: false, temperature: 28.5, voltage: 4.15, current: -450, health: 'good', technology: 'Li-ion', capacity: 5000 } },
    '/wifi':                       { ok: true, data: { ssid: 'DEMO-WiFi', rssi: -55, link_speed: 433, frequency: 5180 } },
    '/wifi/detailed':              { ok: true, data: { ssid: 'DEMO-WiFi', bssid: 'aa:bb:cc:dd:ee:ff', rssi: -55, link_speed: 433, frequency: 5180, ip: '192.168.1.42', gateway: '192.168.1.1', dns: ['8.8.8.8', '1.1.1.1'] } },
    '/wifi/scan':                  { ok: true, data: [
      { ssid: 'DEMO-WiFi', rssi: -55, freq: 5180 },
      { ssid: 'Neighbor-1', rssi: -72, freq: 2412 },
      { ssid: 'Neighbor-2', rssi: -80, freq: 2437 },
    ] },
    '/device':                     { ok: true, data: { model: 'DEMO Phone', manufacturer: 'mtapi', sdk: 34, brand: 'demo', device: 'mock', product: 'mtapi' } },
    '/location':                   { ok: true, data: { lat: 55.7558, lon: 37.6173, accuracy: 15, provider: 'gps', time: now() } },
    '/location/detailed':          { ok: true, data: { lat: 55.7558, lon: 37.6173, altitude: 156, accuracy: 15, speed: 0, bearing: 0, provider: 'gps', time: now() } },
    '/clipboard':                  { ok: true, data: { text: 'DEMO clipboard content' } },

    // System
    '/system':                     { ok: true, data: { model: 'DEMO Phone', sdk: 34, kernel: '5.10.0-demo', uptime: 3600, locale: 'ru-RU', timezone: 'Europe/Moscow' } },
    '/cpu/detail':                 { ok: true, data: { cores: 8, arch: 'arm64-v8a', max_freq: 2800, min_freq: 300, current_freq: [1800, 1800, 1200, 1200, 800, 800, 800, 800] } },
    '/thermal':                    { ok: true, data: { zones: [{ name: 'cpu-0', temp: 42.5 }, { name: 'gpu', temp: 38.2 }, { name: 'battery', temp: 28.5 }] } },
    '/memory':                     { ok: true, data: { total: 8589934592, used: 4294967296, free: 2147483648, cached: 2147483648 } },
    '/storage':                    { ok: true, data: [{ mount: '/data', total: 128849018880, used: 64424509440, free: 64424509440 }] },
    '/kernel':                     { ok: true, data: { version: '5.10.0-demo', build: '#1 SMP PREEMPT', arch: 'aarch64' } },

    // Network
    '/network':                    { ok: true, data: { type: 'wifi', connected: true, metered: false } },
    '/bluetooth':                  { ok: true, data: { enabled: false, paired: [] } },
    '/telephony':                  { ok: true, data: { sim_state: 'ready', network: 'DEMO-Carrier', signal: -75 } },

    // Display / Audio
    '/display':                    { ok: true, data: { width: 1080, height: 2400, density: 450, brightness: 0.7, refresh: 120 } },
    '/display/brightness':         { ok: true, data: { level: 175, max: 255 } },
    '/display/color':              { ok: true, data: { mode: 'adaptive', color_space: 'srgb' } },
    '/audio':                      { ok: true, data: { music: 8, ring: 6, alarm: 7, notification: 5, call: 8 } },
    '/microphone':                 { ok: true, data: { muted: false, available: true } },
    '/audio/ringer':               { ok: true, data: { mode: 'normal' } },

    // Sensors
    '/sensors':                    { ok: true, data: {
      accelerometer: { x: 0.12, y: 0.34, z: 9.78, ts: ts() },
      gyroscope:     { x: 0.001, y: 0.002, z: 0.003, ts: ts() },
      magnetometer:  { x: 22.4, y: -15.1, z: 43.7, ts: ts() },
      light:         { value: 320, ts: ts() },
      proximity:     { value: 0, ts: ts() },
      pressure:      { value: 1013.25, ts: ts() },
    } },
    '/sensors/read':               { ok: true, data: { x: 0.12, y: 0.34, z: 9.78, ts: ts() } },
    '/sensors/stream':             { ok: true, data: { stream: 'started', hz: 10 } },
    '/sensors/stream/stop':        { ok: true, data: { stream: 'stopped' } },

    // Hardware
    '/features':                   { ok: true, data: ['camera', 'flash', 'gps', 'nfc', 'sensors', 'telephony', 'wifi'] },
    '/camera/list':                { ok: true, data: [
      { id: '0', facing: 'back', megapixels: 48 },
      { id: '1', facing: 'front', megapixels: 12 },
    ] },

    // Apps
    '/app/list':                   { ok: true, data: [
      { pkg: 'com.android.settings', name: 'Settings' },
      { pkg: 'com.android.chrome', name: 'Chrome' },
      { pkg: 'dev.mtapi', name: 'mtapi (DEMO)' },
      { pkg: 'com.termux', name: 'Termux' },
    ] },

    // Contacts / SMS
    '/contacts':                   { ok: true, data: [
      { name: 'DEMO Contact 1', phone: '+7 900 000-00-01' },
      { name: 'DEMO Contact 2', phone: '+7 900 000-00-02' },
    ] },
    '/calllog':                    { ok: true, data: [
      { number: '+7 900 000-00-01', type: 'incoming', duration: 45, ts: ts() - 3600000 },
    ] },
    '/sms':                        { ok: true, data: [
      { address: '+7 900 000-00-01', body: 'DEMO SMS', ts: ts() - 7200000 },
    ] },

    // Detailed
    '/locale':                     { ok: true, data: { language: 'ru', country: 'RU', timezone: 'Europe/Moscow' } },
    '/calendar':                   { ok: true, data: [
      { title: 'DEMO Event 1', start: now(), end: now() },
    ] },
    '/alarm/next':                 { ok: true, data: { time: '07:00', label: 'DEMO alarm', enabled: true } },

    // Files
    '/files/save':                 { ok: true, data: { path: '/data/local/tmp/demo.txt', size: 5 } },
    '/tts/voices':                 { ok: true, data: ['ru-RU', 'en-US', 'de-DE'] },

    // Debug (for mtapi-debug.js)
    '/debug':                      { ok: true, logcat: 'DEMO logcat\nvia /debug' },
    '/devtools/json':              { ok: true, data: [
      { id: 'demo-webview', title: 'mtapi DEMO', url: 'http://127.0.0.1:7788/', type: 'page' },
    ] },
  };

  // ── fetch shim ──
  const origFetch = window.fetch;
  window.fetch = function(url, opts) {
    let urlStr = String(url);
    let path = urlStr;
    let query = '';
    try {
      const u = new URL(urlStr, location.origin);
      path = u.pathname;
      query = u.search;
    } catch (e) {}

    // Match by exact path
    if (MOCK[path]) {
      const body = JSON.stringify(MOCK[path]);
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Demo': 'true' },
      }));
    }

    // POST actions (toast, vibrate, notify, torch, ...) → generic ok
    const POST_ACTIONS = ['/toast', '/notify', '/vibrate', '/torch', '/tts', '/share', '/files/save', '/audio/play', '/audio/play/stop', '/tts/stop', '/microphone/record', '/app/launch', '/call', '/restart'];
    if (POST_ACTIONS.some(p => path === p || path.startsWith(p + '?'))) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { demo: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    // Clipboard set
    if (path === '/clipboard' && (opts && opts.method === 'POST')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { set: true } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }

    // Watch endpoints (POST → started)
    if (path.startsWith('/clipboard/watch') || path.startsWith('/location/watch')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { started: true, demo: true } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }

    // Fallback: try real fetch (will 404 on GH Pages for /api paths)
    if (path.startsWith('/api') || path.startsWith('/battery') || path.startsWith('/sensors') || path.startsWith('/camera') || path.startsWith('/net')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: {}, demo: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }

    return origFetch.call(window, url, opts);
  };

  // ── TOKEN for app.js (mock) ──
  if (typeof window.TOKEN === 'undefined') {
    window.TOKEN = 'DEMO';
  }

  console.log('[mock-backend] loaded. ' + Object.keys(MOCK).length + ' endpoints mocked. DEMO mode.');
})();
