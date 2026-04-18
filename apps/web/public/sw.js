// MAX Studio — Service Worker
// Responsabilidades:
//   1) Instalable (skipWaiting + claim → activación inmediata).
//   2) Network-first para navegación (fallback offline básico).
//   3) Recibir push notifications (Step 15-B).
//   4) Manejar clicks en notificaciones → abrir PWA.
//
// Estrategia intencionalmente SIMPLE: no cacheamos API calls ni WS.
// El Gateway es fuente de verdad y no queremos servir datos obsoletos.

const CACHE_NAME = "max-studio-v1";
const OFFLINE_URL = "/offline";

// Recursos que precachamos al instalar — mínimos para que la shell arranque offline.
const PRECACHE = ["/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precache best-effort — si falla uno no rompe la instalación.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      // Activar inmediatamente, sin esperar a que se cierren las pestañas.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpia caches viejas (distintas versión).
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Permite que el cliente force la activación de una versión nueva.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Network-first para documentos HTML; resto pasa sin interceptar.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET. Nada de POST/PUT/DELETE.
  if (req.method !== "GET") return;

  // Solo navegación (documentos). CSS/JS/fonts van directo a la red
  // (Next los sirve con hash → caché HTTP normal ya funciona).
  if (req.mode !== "navigate") return;

  // Skipear API/WS — nunca cachear.
  const url = new URL(req.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/ws") ||
    url.pathname.startsWith("/_next/data")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        // Offline → intenta servir la página offline.
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        return (
          cached ||
          new Response("Sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});

// --- Push notifications (activo desde Step 15-B) ---
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "MAX", body: event.data.text() };
  }

  const title = payload.title || "MAX Studio";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon.svg",
    badge: "/icon.svg",
    tag: payload.tag || "max-notification",
    data: {
      url: payload.url || "/",
      ...(payload.data || {}),
    },
    vibrate: [100, 50, 100],
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Si ya hay una ventana abierta de la PWA, enfócala y navega.
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      // Sin ventana → abre una nueva.
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
