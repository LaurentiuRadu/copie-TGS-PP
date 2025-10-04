// iOS-Specific PWA Update Utilities

/**
 * Detectează dacă aplicația rulează în iOS PWA standalone mode
 */
export function isIOSPWA(): boolean {
  // iOS Safari standalone mode
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  
  // iOS Safari display-mode: standalone (iOS 11.3+)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isIOS;
  }
  
  return false;
}

/**
 * Detectează dacă device-ul este iOS
 */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Forțează refresh complet (clear cache + reload)
 * Util pentru iOS PWA care nu se actualizează automat
 */
export async function forceRefreshApp(): Promise<void> {
  if ('serviceWorker' in navigator) {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  }
  
  // Hard reload cu cache clear
  window.location.reload();
}

/**
 * Verifică versiunea aplicației din manifest
 */
export async function checkAppVersion(): Promise<string | null> {
  try {
    const response = await fetch('/manifest.json', { cache: 'no-cache' });
    const manifest = await response.json();
    return manifest.version || null;
  } catch (error) {
    console.error('Failed to check app version:', error);
    return null;
  }
}

/**
 * Compară versiunea curentă cu cea din localStorage
 * Returnează true dacă există versiune nouă
 */
export async function hasNewVersion(): Promise<boolean> {
  const currentVersion = await checkAppVersion();
  if (!currentVersion) return false;
  
  const storedVersion = localStorage.getItem('app-version');
  
  if (!storedVersion) {
    localStorage.setItem('app-version', currentVersion);
    return false;
  }
  
  if (storedVersion !== currentVersion) {
    localStorage.setItem('app-version', currentVersion);
    return true;
  }
  
  return false;
}
