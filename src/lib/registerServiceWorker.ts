import { toast } from "@/hooks/use-toast";

// Register Service Worker pentru PWA functionality - iOS Optimized
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          if (import.meta.env.DEV) {
            console.info('✅ Service Worker registered:', registration.scope);
          }

          // Verifică pentru actualizări la fiecare 5 minute (iOS needs frequent checks)
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('🔄 Versiune nouă disponibilă!');
                  
                  // Trimite mesaj pentru a activa noul service worker
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  
                  // iOS: Afișează toast pentru reload manual (iOS nu permite reload automat în PWA)
                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                  const isStandalone = (window.navigator as any).standalone === true || 
                                      window.matchMedia('(display-mode: standalone)').matches;
                  
                  if (isIOS && isStandalone) {
                    toast({
                      title: "🎉 Versiune Nouă Disponibilă!",
                      description: "Închide și redeschide aplicația pentru actualizare.",
                      duration: 10000,
                    });
                  } else {
                    // Desktop/Android: reload automat
                    toast({
                      title: "Actualizare...",
                      description: "Aplicația se actualizează automat.",
                      duration: 2000,
                    });
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  }
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
