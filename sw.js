const CACHE_NAME = 'guinchos-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js'
];

// Instalar service worker
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalando...');
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache aberto');
                return cache.addAll(ASSETS);
            })
            .catch((err) => {
                console.error('[Service Worker] Erro ao cachear:', err);
            })
    );
    self.skipWaiting();
});

// Ativar service worker
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Ativando...');
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', (e) => {
    // Ignorar requisições para APIs externas e Supabase
    if (
        e.request.url.includes('supabase.co') ||
        e.request.url.includes('cdnjs.cloudflare.com') ||
        e.request.url.includes('cdn.jsdelivr.net') ||
        e.request.url.startsWith('chrome-extension://') ||
        !e.request.url.startsWith('http')
    ) {
        return;
    }

    e.respondWith(
        caches.match(e.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(e.request).catch(() => {
                    // Fallback para offline
                    if (e.request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
