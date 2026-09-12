// Minimal app-shell service worker -- NOT an offline data layer. Ledger's
// pages are almost entirely server-rendered, authenticated, and show real
// account balances; caching that HTML would risk silently showing stale
// financial figures while "offline", which is worse than showing nothing.
// So this only does one job: if a page navigation fails because the
// connection just dropped, show a friendly cached offline page instead of
// the browser's blank/error screen. Everything else (assets, API/server
// action calls) passes straight through to the network, uncached.
const CACHE_NAME = "ledger-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept top-level page navigations -- this is the only request
  // type whose failure produces the browser's own blank/error screen; a
  // failed asset or API call should just fail normally and let the app's
  // own error handling deal with it.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error()))
  );
});
