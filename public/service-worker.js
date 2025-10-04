// Service Worker pentru PWA - iOS-Optimized Auto-Update
// Versiune statică pentru cache consistency (incrementează manual la fiecare deploy)
const CACHE_VERSION = '1.0.4';
const CACHE_NAME = `timetrack-v${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// Cache mai multe resurse pentru offline
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/mobile',
  '/admin'
];

// Cache pentru API responses (cu expirare)
const API_CACHE_NAME = 'api-cache-v1';
const API_CACHE_TIME = 5 * 60 * 1000; // 5 minute

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

// Activate Service Worker - Aggressive cache cleanup
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clear API cache if version changed
      caches.delete(API_CACHE_NAME).then(() => {
        console.log('🔄 API cache cleared for fresh start');
      })
    ])
  );
  self.clients.claim();
});

// Fetch Strategy: Network First cu cache inteligent
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // Strategy pentru API calls Supabase
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          
          // Cache doar GET requests success
          if (request.method === 'GET' && response.ok) {
            const responseToCache = response.clone();
            const headers = new Headers(responseToCache.headers);
            headers.append('sw-cache-time', Date.now().toString());
            
            const cachedResponse = new Response(responseToCache.body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: headers
            });
            
            cache.put(request, cachedResponse);
          }
          
          return response;
        } catch (error) {
          // Fallback la cache doar dacă e fresh (< 5 min)
          const cached = await cache.match(request);
          if (cached) {
            const cacheTime = cached.headers.get('sw-cache-time');
            if (cacheTime && (Date.now() - parseInt(cacheTime)) < API_CACHE_TIME) {
              return cached;
            }
          }
          throw error;
        }
      })
    );
    return;
  }

  // Strategy pentru resurse statice: Cache First
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        
        return fetch(request).then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // Strategy pentru navegare și HTML: Network First (iOS critical!)
  event.respondWith(
    fetch(request, {
      cache: 'no-cache', // Force fresh fetch for HTML
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
      .then((response) => {
        // Cache doar dacă nu e HTML (pentru offline fallback)
        if (!request.url.includes('.html') && request.mode === 'navigate') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((response) => {
          if (response) return response;
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
