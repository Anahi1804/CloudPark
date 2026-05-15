// sw.js - Service Worker Básico para permitir instalación PWA
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalación completada.');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activado y listo.');
});

self.addEventListener('fetch', (e) => {

    e.respondWith(fetch(e.request).catch(() => {
        console.log("Estás sin conexión a internet.");
    }));
});