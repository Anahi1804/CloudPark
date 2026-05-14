// sw.js - Service Worker Básico para permitir instalación PWA
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalación completada.');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activado y listo.');
});

// Este paso es obligatorio para que Chrome/Safari aprueben la instalación
self.addEventListener('fetch', (e) => {
    // Por ahora solo dejamos pasar todas las peticiones a internet normalmente
    e.respondWith(fetch(e.request).catch(() => {
        console.log("Estás sin conexión a internet.");
    }));
});