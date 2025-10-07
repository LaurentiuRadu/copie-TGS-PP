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
    // Pentru iOS PWA, folosim doar reload simplu
    // Ștergerea agresivă de cache poate cauza probleme de autentificare
    if (isIOSPWA()) {
      window.location.reload();
      return;
    }

    // Pentru alte platforme, păstrăm logica de invalidare cache
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        // Activează worker-ul în așteptare
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Așteaptă activarea
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Reload normal
    window.location.reload();
  } catch (error) {
    console.error('Force refresh failed:', error);
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
