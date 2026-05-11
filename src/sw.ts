// src/sw.ts — Bekuta v1 cutover SW (tombstone)
//
// v2 への in-place 切替前に v1 が precache していた旧 chunk を退場させるための
// 最小 SW。fetch ハンドラを持たず、全リクエストはネットワークに素通しする。
// 旧 workbox-precache 系キャッシュは activate 時に全削除する。
// push 通知購読を維持するため、push / notificationclick だけは残す。
// D-day（2026-05-19）に v2 ビルドが同一オリジンで配信され、ブラウザは
// 同じ /sw.js を更新検出して v2 の SW に置き換える。

declare const self: ServiceWorkerGlobalScope;

// vite-plugin-pwa の injectManifest は、ビルド出力に `self.__WB_MANIFEST` の
// 文字列が存在することを要求する（マニフェスト配列に置換される）。
// `void` 等で消費するとミニファイで除去されてビルドが失敗するため、
// グローバルプロパティへ代入することで副作用化し、トリーシェイク耐性を持たせる。
// 値自体は使わない（precache しない）。
(self as unknown as { __bekutaManifestRef: unknown }).__bekutaManifestRef = (
  self as unknown as { __WB_MANIFEST: unknown }
).__WB_MANIFEST;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string } = {};
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
  const url = (event.notification?.data as { url?: string } | undefined)?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
