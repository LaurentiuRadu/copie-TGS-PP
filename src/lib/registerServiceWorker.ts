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

          // Verifică actualizări la fiecare 10 secunde (mai agresiv pentru iOS)
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const updateInterval = isIOS ? 10000 : 30000; // 10s pentru iOS, 30s pentru restul

          setInterval(() => {
            registration.update().catch(() => {
              // Ignoră erorile de update
            });
          }, updateInterval);

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (import.meta.env.DEV) {
                    console.info('🔄 New version available');
                  }
                  
                  // Pentru iOS, nu arăta confirm dialog, doar notificare
                  if (isIOS) {
                    // Lasă UpdateNotification să gestioneze update-ul
                  } else {
                    // Arată confirm dialog pentru alte platforme
                    if (window.confirm('O nouă versiune a aplicației este disponibilă. Actualizați acum?')) {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    }
                  }
                }
              });
            }
          });

          // Forțează verificarea pentru actualizări când devine vizibilă aplicația
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
              registration.update().catch(() => {});
            }
          });

          // Pentru iOS, verificare agresivă când aplicația devine activă
          if (isIOS) {
            window.addEventListener('focus', () => {
              registration.update().catch(() => {});
            });
            
            window.addEventListener('pageshow', (event) => {
              if (event.persisted) {
                // Pagina a fost restaurată din bfcache
                registration.update().catch(() => {});
              }
            });
          }
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });

    // Reîncarcă pagina când un nou service worker preia controlul
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
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
