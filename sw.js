// Bump the version whenever this file changes so old caches get cleared.
const CACHE = 'crucible-v3';

const APP_SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const LIBRARIES = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then(async (cache) => {
        await cache.addAll(APP_SHELL);
        // Best effort: a CDN hiccup shouldn't block install; runtime caching fills gaps later.
        // cdn.tailwindcss.com redirects without CORS headers, so fall back to an opaque copy.
        await Promise.all(LIBRARIES.map(url => cache.add(url)
            .catch(() => fetch(url, { mode: 'no-cors' }).then(res => cache.put(url, res)))
            .catch(() => {})));
    }));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || request.url.includes('generativelanguage.googleapis.com')) return;

    // The page itself: network first so updates arrive, cached copy when offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request.url, { cache: 'no-cache' })  // revalidate, so new versions land immediately
                .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
                .catch(() => caches.match('index.html'))
        );
        return;
    }

    // Libraries, fonts, icons: cache first, fetch and store on a miss.
    event.respondWith(
        caches.match(request).then(hit => hit || fetch(request).then(res => {
            if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
            return res;
        }))
    );
});

// Tapping the 9 PM notification opens (or focuses) the app.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list[0] ? list[0].focus() : self.clients.openWindow('./')));
});
