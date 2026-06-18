const CACHE_NAME = "erpmini-cache-v5";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {

  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  // Navegação principal
  if (event.request.mode === "navigate") {

    event.respondWith(

      fetch(event.request)
        .then((response) => {

          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/", copy);
            cache.put("/index.html", response.clone());
          });

          return response;
        })

        .catch(() => {

          return (
            caches.match("/") ||
            caches.match("/index.html")
          );

        })

    );

    return;
  }

  // Arquivos estáticos
  event.respondWith(

    caches.match(event.request)
      .then((cached) => {

        const fetchPromise = fetch(event.request)
          .then((response) => {

            if (response && response.status === 200) {

              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, copy));

            }

            return response;

          })
          .catch(() => cached);

        return cached || fetchPromise;

      })

  );

});
