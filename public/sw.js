// Bump SW_BUILD with any service worker change. The cache name carries it, so
// activating a new worker drops the previous build's cache instead of serving
// a frozen /offline page and dead hashed chunks forever. v1 shipped with an
// unversioned cache and an unconditional skipWaiting at install; both are the
// reason this header comment exists.
const SW_BUILD = "v2";
const STATIC_CACHE = `vollyio-static-${SW_BUILD}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  // No skipWaiting here: the new worker WAITS, which is what gives the
  // "A new version is ready" toast in components/pwa-register.tsx something
  // true to say. The player chooses the moment the page swaps out from under
  // them, via the message below.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
      ),
    );
  }
});
