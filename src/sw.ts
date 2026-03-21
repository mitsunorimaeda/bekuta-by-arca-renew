// src/sw.ts — Bekuta Service Worker
// vite-plugin-pwa (injectManifest) がビルド時にプリキャッシュマニフェストを注入する
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// =============================================
// 1. プリキャッシュ（ビルド時に自動生成されるマニフェスト）
//    全JS/CSS/HTMLバンドルが含まれる
// =============================================
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// =============================================
// 2. ランタイムキャッシュ戦略
// =============================================

// Supabase API → NetworkOnly
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkOnly()
);

// Sentry → NetworkOnly
registerRoute(
  ({ url }) => url.hostname.includes('sentry.io'),
  new NetworkOnly()
);

// PostHog → NetworkOnly
registerRoute(
  ({ url }) => url.hostname.includes('posthog.com'),
  new NetworkOnly()
);

// ナビゲーション（HTML）→ NetworkFirst（3秒タイムアウト）
const navigationHandler = new NetworkFirst({
  cacheName: 'bekuta-navigations',
  networkTimeoutSeconds: 3,
  plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
});

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/\/auth\/callback/],
  })
);

// 画像 → CacheFirst
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && request.destination === 'image',
  new CacheFirst({
    cacheName: 'bekuta-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// フォント → CacheFirst
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'bekuta-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// =============================================
// 3. オフラインフォールバック
//    ナビゲーション失敗時はプリキャッシュのindex.htmlを返す
// =============================================
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    // プリキャッシュからindex.htmlを返す（Workboxが自動的にハッシュ付きで管理）
    const cache = await caches.match('/index.html');
    if (cache) return cache;
    // Workboxのプリキャッシュ用キャッシュ名でも試す
    const allCaches = await caches.keys();
    for (const cacheName of allCaches) {
      if (cacheName.startsWith('workbox-precache')) {
        const c = await caches.open(cacheName);
        const keys = await c.keys();
        const htmlEntry = keys.find(k => k.url.endsWith('/index.html'));
        if (htmlEntry) {
          const response = await c.match(htmlEntry);
          if (response) return response;
        }
      }
    }
  }
  return Response.error();
});

// =============================================
// 4. プッシュ通知
// =============================================
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data: any = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      const txt = event.data ? await event.data.text() : '';
      data = { title: 'Bekuta', body: txt };
    }

    const title = data.title || 'Bekuta';
    const options: NotificationOptions = {
      body: data.body || '',
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-192x192.png',
      data: { url: data.url || '/' },
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification?.data as any)?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// SW即座にアクティブ化
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
