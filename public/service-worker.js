// Service Worker pentru PWA - Offline support și caching
const CACHE_NAME = `timetrack-v${Date.now()}`;
const OFFLINE_URL = '/';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Curăță cache-urile vechi
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim clienții
      self.clients.claim().then(() => {
        // Notifică toți clienții că sunt actualizări
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              message: 'A new version is available!'
            });
          });
        });
      })
    ])
  );
});

// Fetch Strategy: Network First, falling back to Cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // IMPORTANT: Nu cache-ui cererile către Supabase auth/storage pentru a evita probleme de sesiune
  const url = new URL(event.request.url);
  const skipCache = 
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/auth/') ||
    event.request.url.includes('storage') ||
    event.request.method !== 'GET';

  if (skipCache) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nu cache-ui răspunsurile de eroare
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response before caching
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // If network fails, try to get from cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            
            // If no cache, return offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING message received');
    self.skipWaiting();
  }
});
