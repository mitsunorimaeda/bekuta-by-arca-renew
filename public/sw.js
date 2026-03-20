// =============================================
// Bekuta Service Worker
// - アプリシェルキャッシュ（Workbox）
// - プッシュ通知
// =============================================

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

workbox.setConfig({ debug: false });

const { registerRoute, NavigationRoute, setCatchHandler } = workbox.routing;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst, NetworkOnly } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// =============================================
// 1. プリキャッシュ（install時）
//    asset-manifest.json から全JS/CSSを取得してキャッシュ
// =============================================
const APP_SHELL_CACHE = 'bekuta-app-shell-v3';
const STATIC_CACHE = 'bekuta-static';
const KNOWN_CACHES = [
  APP_SHELL_CACHE,
  STATIC_CACHE,
  'bekuta-navigations',
  'bekuta-images',
  'bekuta-fonts',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // 1. アプリシェル（HTML + アイコン）をキャッシュ
      const shellCache = await caches.open(APP_SHELL_CACHE);
      await shellCache.addAll([
        '/index.html',
        '/manifest.json',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
      ]);

      // 2. asset-manifest.json から全JS/CSSバンドルをキャッシュ
      try {
        const manifestRes = await fetch('/asset-manifest.json');
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          if (manifest.assets && manifest.assets.length > 0) {
            const staticCache = await caches.open(STATIC_CACHE);
            // 並列で取得（1つ失敗しても他は続行）
            await Promise.allSettled(
              manifest.assets.map((url) => staticCache.add(url).catch(() => {}))
            );
            console.log('[SW] Precached', manifest.assets.length, 'assets');
          }
        }
      } catch (e) {
        console.warn('[SW] Asset precache failed (will retry next install):', e);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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

// Workbox CDN → NetworkOnly
registerRoute(
  ({ url }) => url.hostname.includes('storage.googleapis.com'),
  new NetworkOnly()
);

// ナビゲーション（HTML）→ NetworkFirst（3秒タイムアウト）
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'bekuta-navigations',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    { denylist: [/\/auth\/callback/] }
  )
);

// JS/CSS → CacheFirst（ハッシュ付きファイル名なので安全）
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' || request.destination === 'style'),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 150 }),
    ],
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
// =============================================
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const navCached = await caches.match('/index.html', { cacheName: 'bekuta-navigations' });
    if (navCached) return navCached;
    const shellCached = await caches.match('/index.html', { cacheName: APP_SHELL_CACHE });
    if (shellCached) return shellCached;
  }
  return Response.error();
});

// =============================================
// 4. プッシュ通知
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
