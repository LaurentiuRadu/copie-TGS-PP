// Register Service Worker pentru PWA functionality
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully:', registration.scope);

          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available, prompt user to refresh
                  console.log('🔄 New version available! Please refresh.');
                  
                  // Auto-update (optional - putem să facem și prompt pentru user)
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('❌ Service Worker registration failed:', error);
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
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install button or notification
    console.log('💡 PWA install prompt available');
    
    return deferredPrompt;
  });

  return deferredPrompt;
}
