
const CACHE_NAME = 'presta-flow-v4';
const ASSETS = [
    '/',
    '/index.html',
    '/favicon.png',
    '/icon-light.png',
    '/icon-dark.png'
];

// Permite que la app pida la activación inmediata del SW nuevo (auto-actualización).
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Detecta si la petición es de un chunk JS/CSS (hashes que cambian en cada deploy)
function isScriptOrStyle(request, url) {
    if (request.destination === 'script' || request.destination === 'style') return true;
    return url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    if (event.request.mode === 'navigate') {
        // Network-first para navegación/HTML
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/').then(r => r || caches.match('/index.html')))
        );
        return;
    }

    if (isScriptOrStyle(event.request, url)) {
        // Network-first para JS/CSS: tras un deploy los hashes de chunk cambian,
        // así siempre se obtiene el chunk fresco y nunca queda bloqueado por caché obsoleta.
        // En caso de fallo de red, se recurre a la caché como respaldo offline.
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Actualiza la caché con la versión nueva (solo respuestas válidas)
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first para el resto de assets estáticos (imágenes/iconos/fuentes)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
