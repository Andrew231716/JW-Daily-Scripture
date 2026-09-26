const CACHE_NAME = "jw-daily-scripture-v5";
const STATIC_ASSETS = ["/styles.css", "/manifest.json", "/icons/mark.svg", "/icons/icon-192.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for HTML/JS so updates aren't stuck behind old cache.
  const networkFirst =
    event.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith("/sw.js");

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

async function showDailyNotification(title, body) {
  const options = {
    body: body || "Tocca per ascoltare la lettura di oggi",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: "jwds-daily",
    renotify: true,
    data: { url: "/?play=1&source=notification" },
  };
  await self.registration.showNotification(title || "JW Daily Scripture", options);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "notify-now") {
    showDailyNotification(data.title, data.body);
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "JW Daily Scripture", {
      body: data.body || "Tocca per ascoltare la scrittura di oggi",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      tag: "jwds-daily",
      renotify: true,
      data: { url: data.url || "/?play=1&source=notification" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/?play=1&source=notification";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
      return undefined;
    })
  );
});
