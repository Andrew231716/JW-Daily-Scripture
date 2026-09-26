const CACHE_NAME = "jw-daily-scripture-v4";
const STATIC_ASSETS = ["/styles.css", "/manifest.json", "/icons/mark.svg", "/icons/icon-192.svg"];
const SCHEDULE_KEY = "jwds-schedule";

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
      const saved = await readSchedule();
      if (saved?.enabled) {
        const when = nextFromHhmm(saved.notifyTime || "07:00").getTime();
        armSchedule(when, saved.title, saved.body, saved.notifyTime);
      }
    })()
  );
});

async function readSchedule() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(SCHEDULE_KEY);
    return res ? res.json() : null;
  } catch {
    return null;
  }
}

async function writeSchedule(data) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    SCHEDULE_KEY,
    new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
  );
}

async function clearScheduleStore() {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(SCHEDULE_KEY);
}

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

let scheduleTimer = null;
let dayRolloverTimer = null;
let preferredTime = "07:00";

function clearTimers() {
  if (scheduleTimer) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  if (dayRolloverTimer) {
    clearTimeout(dayRolloverTimer);
    dayRolloverTimer = null;
  }
}

function nextFromHhmm(hhmm) {
  const [h, m] = String(hhmm || "07:00")
    .split(":")
    .map(Number);
  const when = new Date();
  when.setSeconds(0, 0);
  when.setHours(h, m, 0, 0);
  if (when.getTime() <= Date.now() + 1500) {
    when.setDate(when.getDate() + 1);
  }
  return when;
}

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

function armSchedule(whenMs, title, body, notifyTime) {
  clearTimers();
  preferredTime = notifyTime || preferredTime;
  const delay = Math.max(0, whenMs - Date.now());

  writeSchedule({
    enabled: true,
    when: whenMs,
    title,
    body,
    notifyTime: preferredTime,
  }).catch(() => {});

  const fire = async () => {
    await showDailyNotification(title, body);
    const next = nextFromHhmm(preferredTime);
    armSchedule(next.getTime(), title, body, preferredTime);
  };

  scheduleTimer = setTimeout(fire, delay);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear-schedules") {
    clearTimers();
    clearScheduleStore().catch(() => {});
    return;
  }
  if (data.type === "notify-now") {
    showDailyNotification(data.title, data.body);
    return;
  }
  if (data.type === "schedule") {
    armSchedule(data.when, data.title, data.body, data.notifyTime);
  }
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

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "jwds-daily-check") return;
  event.waitUntil(showDailyNotification("JW Daily Scripture", "È ora della scrittura di oggi"));
});
