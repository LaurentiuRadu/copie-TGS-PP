// Register Service Worker pentru PWA functionality
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    let updateIntervalId: number | null = null;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Named handlers pentru cleanup corect
    const handleVisibilityChange = (registration: ServiceWorkerRegistration) => () => {
      if (!document.hidden) {
        registration.update().catch(() => {});
      }
    };

    const handleFocus = (registration: ServiceWorkerRegistration) => () => {
      registration.update().catch(() => {});
    };

    const handlePageShow = (registration: ServiceWorkerRegistration) => (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Pagina a fost restaurată din bfcache
        registration.update().catch(() => {});
      }
    };

    const handleLoad = () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          if (import.meta.env.DEV) {
            console.info('✅ Service Worker registered:', registration.scope);
          }

          // Verifică actualizări la interval - optimized for battery life
          const updateInterval = 30 * 60 * 1000; // 30 minutes
          updateIntervalId = window.setInterval(() => {
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

          // Attach event listeners cu referințe pentru cleanup
          const visibilityHandler = handleVisibilityChange(registration);
          document.addEventListener('visibilitychange', visibilityHandler);

          // Pentru iOS, verificare agresivă când aplicația devine activă
          if (isIOS) {
            const focusHandler = handleFocus(registration);
            const pageShowHandler = handlePageShow(registration);
            
            window.addEventListener('focus', focusHandler);
            window.addEventListener('pageshow', pageShowHandler);
            
            // Store handlers pentru potential cleanup (nu e nevoie în practică, dar best practice)
            (registration as any)._cleanupHandlers = {
              visibilityHandler,
              focusHandler,
              pageShowHandler,
            };
          } else {
            (registration as any)._cleanupHandlers = {
              visibilityHandler,
            };
          }
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    };

    window.addEventListener('load', handleLoad);

    // Reîncarcă pagina când un nou service worker preia controlul
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Cleanup function (poate fi apelată la unmount dacă e nevoie)
    return () => {
      if (updateIntervalId !== null) {
        clearInterval(updateIntervalId);
      }
      window.removeEventListener('load', handleLoad);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }
  
  return () => {}; // noop cleanup
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
