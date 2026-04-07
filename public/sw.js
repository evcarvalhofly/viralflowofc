// ViralFlow Service Worker
const CACHE_VERSION = 'viralflow-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Web Push (servidor → usuário quando app está fechado) ───────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(
    Promise.all([
      // Mostra notificação nativa
      self.registration.showNotification(data.title ?? 'ViralFlow', {
        body: data.body ?? '',
        icon: '/pwa-icon.svg',
        badge: '/pwa-icon.svg',
        tag: data.tag ?? 'viralflow',
        data: { url: data.url ?? '/' },
        vibrate: [200, 100, 200],
        requireInteraction: false,
      }),
      // Avisa o app (se estiver aberto) com tipo da notificação
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const msgType = data.notificationType === 'aviso' ? 'PUSH_AVISO' : 'PUSH_SALE';
        clients.forEach((client) => {
          client.postMessage({ type: msgType, data });
        });
      }),
    ])
  );
});

// ── Background notifications (main thread → SW quando aba em fundo) ─
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      tag: tag ?? 'viralflow-bg',
      data: { url: url ?? '/' },
      vibrate: [100, 50, 100],
    });
  }
});

// ── Clique na notificação → abre/foca o app ─────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            // Só navega se não estiver na URL correta — evita recarregar a página
            const clientUrl = new URL(client.url);
            const targetUrl = new URL(url, self.location.origin);
            if (clientUrl.pathname !== targetUrl.pathname) {
              client.navigate(url);
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
