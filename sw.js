// ===== SERVICE WORKER — Calendário Sagrado Naucratita =====
// Faz o cache do "app shell" (HTML, manifest, ícones) para que o app
// abra normalmente mesmo sem conexão com a internet.

// Sempre que publicar uma nova versão do site, mude este número de versão
// (ex: 'naucratita-v2'). Isso força os navegadores dos usuários a buscarem
// os arquivos atualizados em vez de continuarem usando os antigos do cache.
const CACHE_VERSION = 'naucratita-v2';

// Arquivos essenciais para o app abrir offline.
// IMPORTANTE: cache.addAll() é "tudo ou nada" — se QUALQUER arquivo desta lista
// não existir (404), a instalação inteira do service worker falha silenciosamente.
// Por isso os nomes abaixo precisam bater exatamente com os arquivos publicados na raiz do site.
const APP_SHELL = [
    '/',
    '/index.html',
    '/site.webmanifest',
    '/favicon.ico',
    '/favicon.svg',
    '/favicon-96x96.png',
    '/apple-touch-icon.png',
    '/web-app-manifest-192x192.png',
    '/web-app-manifest-512x512.png'
];

// ===== INSTALL =====
// Baixa e guarda o app shell assim que o service worker é instalado.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) =>
                Promise.all(
                    APP_SHELL.map((url) =>
                        cache.add(url).catch((err) =>
                            console.warn('[SW] Não foi possível cachear', url, err)
                        )
                    )
                )
            )
            .then(() => self.skipWaiting())
    );
});

// ===== ACTIVATE =====
// Remove caches de versões antigas, para não acumular lixo no dispositivo do usuário.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_VERSION)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// ===== FETCH =====
// Estratégia:
// - Navegação (abrir o app): tenta a rede primeiro; se falhar (offline),
//   cai para o HTML salvo em cache, garantindo que o app sempre abra.
// - Demais arquivos do mesmo site (CSS/JS/ícones/manifest): cache primeiro,
//   com atualização em segundo plano (stale-while-revalidate).
// - Recursos de outros domínios (ex: Google Fonts): tenta rede, com
//   fallback para cache quando disponível; nunca quebra o app se falhar.
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;

    // Navegação (o usuário abrindo/recarregando o app)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', clone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    if (isSameOrigin) {
        // Cache primeiro, atualizando em segundo plano
        event.respondWith(
            caches.match(request).then((cached) => {
                const networkFetch = fetch(request)
                    .then((response) => {
                        const clone = response.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
                        return response;
                    })
                    .catch(() => cached);
                return cached || networkFetch;
            })
        );
    } else {
        // Recursos externos (ex.: fontes do Google Fonts)
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
    }
});
