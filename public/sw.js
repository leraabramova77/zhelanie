// Пути считаются от scope воркера — так он работает и в подпапке GitHub Pages.
const base = self.registration.scope;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Желание недели', {
      body: data.body || '',
      icon: `${base}icon.svg`,
      badge: `${base}icon.svg`,
      tag: 'wish-of-the-week',
      data: { url: base },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(base);
    }),
  );
});
