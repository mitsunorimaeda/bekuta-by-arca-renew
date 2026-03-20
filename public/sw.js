// =============================================
// Bekuta Service Worker
// - アプリシェルキャッシュ（Workbox）
// - プッシュ通知
// =============================================

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Workbox の設定
workbox.setConfig({ debug: false });

const { registerRoute, NavigationRoute, setCatchHandler } = workbox.routing;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst, NetworkOnly } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// =============================================
// 1. アプリシェルのプリキャッシュ（install時）
// =============================================
const APP_SHELL_CACHE = 'bekuta-app-shell-v1';
const KNOWN_CACHES = [
  APP_SHELL_CACHE,
  'bekuta-navigations',
  'bekuta-static',
  'bekuta-images',
  'bekuta-fonts',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll([
        '/index.html',
        '/manifest.json',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 既知のキャッシュとworkbox内部キャッシュのみ保持、古いキャッシュは削除
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !KNOWN_CACHES.includes(key) && !key.startsWith('workbox-'))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// =============================================
// 2. ランタイムキャッシュ戦略
// =============================================

// Supabase API → NetworkOnly（キャッシュしない）
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkOnly()
);

// Sentry → NetworkOnly
registerRoute(
  ({ url }) => url.hostname.includes('sentry.io'),
  new NetworkOnly()
);

// ナビゲーション（HTML）→ NetworkFirst（3秒タイムアウト）
const navigationHandler = new NetworkFirst({
  cacheName: 'bekuta-navigations',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});

registerRoute(
  new NavigationRoute(navigationHandler, {
    // Supabase auth callback は除外
    denylist: [/\/auth\/callback/],
  })
);

// JS/CSS（same-origin）→ StaleWhileRevalidate
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' || request.destination === 'style'),
  new StaleWhileRevalidate({
    cacheName: 'bekuta-static',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100 }),
    ],
  })
);

// 画像（same-origin）→ CacheFirst（30日、最大60件）
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
//    NavigationRoute のキャッシュにない場合、
//    プリキャッシュした index.html を返す
// =============================================
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const cached = await caches.match('/index.html', { cacheName: APP_SHELL_CACHE });
    if (cached) return cached;
  }
  return Response.error();
});

// =============================================
// 4. プッシュ通知（既存機能を保持）
// =============================================
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (e) {
      const txt = event.data ? await event.data.text() : "";
      data = { title: "Bekuta", body: txt };
    }

    const title = data.title || "Bekuta";
    const options = {
      body: data.body || "",
      icon: data.icon || "/pwa-192x192.png",
      badge: data.badge || "/pwa-192x192.png",
      data: { url: data.url || "/" },
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
