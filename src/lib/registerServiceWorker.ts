// Register Service Worker pentru PWA functionality
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          if (import.meta.env.DEV) {
            console.info('✅ Service Worker registered:', registration.scope);
          }

          // Verifică automat pentru actualizări la fiecare oră
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('🔄 Versiune nouă disponibilă - Actualizare automată...');
                  
                  // Trimite mesaj pentru a activa noul service worker
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  
                  // Așteaptă puțin și reîncarcă pagina
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}

// Detect if app is running in standalone mode (PWA installed)
export function isStandalone(): boolean {
  // iOS
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  
  // Android
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  return false;
}

// Prompt user to install PWA
export function promptInstall() {
  let deferredPrompt: any;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (import.meta.env.DEV) {
      console.info('💡 PWA install prompt available');
    }
    
    return deferredPrompt;
  });

  return deferredPrompt;
}
