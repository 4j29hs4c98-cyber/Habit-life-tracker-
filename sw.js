// Offline support: cache the app files, serve them when there is no connection.
const VERSION = 'v9';
const SHELL = ['./', './index.html', './styles.css', './app.js', './db.js', './sync.js', './push.js', './i18n.js', './pdf.js', './attach.js', './config.js', './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Fonts: cache after first load
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => new Response('', { status: 503 }))));
    return;
  }
  // Supabase library: pinned version, cache it so the app opens offline
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // App files: network first (so updates arrive), cache when offline
  e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })
    .catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match('./index.html')));
});

// Push notifications
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Life Tracker', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Life Tracker', {
    body: d.body || '', icon: './icon-192.png', tag: d.tag || 'reminder', renotify: true, data: { url: d.url || '#today' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hash = e.notification.data?.url || '#today';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ type: 'open', hash }); return open.focus(); }
    return self.clients.openWindow(new URL('./' + hash, self.registration.scope).href);
  }));
});
