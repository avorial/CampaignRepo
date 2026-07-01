// CampaignRepo Service Worker - PWA offline support
const CACHE = "campaignrepo-v2";
const SHELL = ["/", "/dashboard", "/login", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // API and media: network only, no cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/campaign-media/") ||
    url.pathname.startsWith("/public-media/")
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests return the offline page
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
          return Response.error();
        })
      )
  );
});
