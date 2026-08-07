const CACHE_NAME = 'timbersmith-terminal-v1.0.0.020';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-192x192.png',
  '/icons/maskable-512x512.png',
  '/apple-touch-icon.png'
];

// Install Event - Pre-cache essential static shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Timbersmith Terminal SW...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning:', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event - Clean old caches & take control immediately
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Timbersmith Terminal SW...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event - Stale-while-revalidate strategy with offline fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or non-HTTP(S) protocols
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Skip browser extension schemes or Firestore live channel streams
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[Service Worker] Network request failed, returning cached version if available:', err);
          return cachedResponse;
        });

      // Return cached version immediately if available, otherwise wait for network
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetchPromise.then((response) => {
        if (response) return response;

        // If offline and requesting an HTML page, serve cached index.html
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }

        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
