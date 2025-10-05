import { toast } from "@/hooks/use-toast";

// Version check frequency
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minute

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

          // Verifică pentru actualizări mai des (la fiecare 30 min)
          setInterval(() => {
            console.log('🔍 Checking for updates...');
            registration.update();
          }, VERSION_CHECK_INTERVAL);
          
          // Check imediat după înregistrare
          setTimeout(() => registration.update(), 5000);

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              console.log('🆕 New service worker found, installing...');
              
              newWorker.addEventListener('statechange', () => {
                console.log('📊 SW state:', newWorker.state);
                
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('🔄 Versiune nouă disponibilă!');
                  
                  // Set flag for update badge
                  localStorage.setItem('new-version-available', 'true');
                  
                  // Dispatch custom event for UpdateBadge component
                  window.dispatchEvent(new CustomEvent('app-update-available'));
                  
                  // NU trimitem SKIP_WAITING automat - lăsăm utilizatorul să decidă
                  // newWorker.postMessage({ type: 'SKIP_WAITING' });
                  
                  // iOS: Afișează toast pentru reload manual (iOS nu permite reload automat în PWA)
                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                  const isStandalone = (window.navigator as any).standalone === true || 
                                      window.matchMedia('(display-mode: standalone)').matches;
                  
                  if (isIOS && isStandalone) {
                    toast({
                      title: "🎉 Versiune Nouă!",
                      description: "Pentru actualizare: închide complet aplicația (swipe up din App Switcher) și redeschide-o.",
                      duration: 15000,
                    });
                  } else {
                    // Desktop/Android: arată toast cu opțiune de actualizare
                    toast({
                      title: "✨ Update Disponibil",
                      description: "Apasă pe iconița 🔄 pentru a actualiza aplicația.",
                      duration: 8000,
                    });
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
