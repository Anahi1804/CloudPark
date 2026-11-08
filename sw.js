// sw.js - Service Worker con control de versión para limpiar caché en PWA
const CACHE_VERSION = 'parkil-v3';

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalando versión:', CACHE_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activado y limpiando versiones antiguas...');
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => k !== CACHE_VERSION && caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            console.log("Sin conexión a internet.");
        })
    );
});