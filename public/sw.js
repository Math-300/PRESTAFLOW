// Service worker DESHABILITADO intencionalmente.
// La PWA provocaba recargas dobles y no era la causa del problema (era Supabase).
// Este SW se auto-elimina: limpia todas las cachés y se desinstala para que los
// usuarios con un worker viejo queden libres de él. No intercepta peticiones (red directa).

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.claim())
    );
});
