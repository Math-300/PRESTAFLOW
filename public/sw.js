
const CACHE_NAME = 'presta-flow-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/favicon.png',
    '/icon-light.png',
    '/icon-dark.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        }).catch(() => {
            // Fallback for document requests if offline
            if (event.request.mode === 'navigate') {
                return caches.match('/');
            }
        })
    );
});
