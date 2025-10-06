/**
 * iOS PWA Update Utilities
 * Gestionează actualizări și detectare PWA pe iOS
 */

/**
 * Detectează dacă aplicația rulează ca PWA pe iOS
 */
export function isIOSPWA(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true;
  return isIOS && isStandalone;
}

/**
 * Forțează reîncărcarea completă a aplicației
 * Foarte util pentru PWA pe iOS care cache-uiește agresiv
 */
export async function forceRefreshApp(): Promise<void> {
  try {
    // 1. Încearcă să invalideze cache-ul Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
      }
      
      // Așteaptă puțin pentru ca unregister să se completeze
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 2. Șterge cache-urile browser-ului
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }

    // 3. Force reload cu bypass cache
    window.location.reload();
  } catch (error) {
    console.error('Force refresh failed:', error);
    // Fallback la reload simplu
    window.location.reload();
  }
}

/**
 * Verifică dacă există o versiune nouă disponibilă
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      return false;
    }

    // Forțează verificarea pentru actualizări
    await registration.update();

    // Verifică dacă există un worker în așteptare
    return !!registration.waiting || !!registration.installing;
  } catch (error) {
    console.error('Check for updates failed:', error);
    return false;
  }
}

/**
 * Activează service worker-ul în așteptare
 */
export function activateWaitingServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.getRegistration().then(registration => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reîncarcă când noul SW devine activ
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  });
}
