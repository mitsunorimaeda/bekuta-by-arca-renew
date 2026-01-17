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