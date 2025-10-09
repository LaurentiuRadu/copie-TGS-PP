import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useUpdateNotifications() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Verifică dacă browser-ul suportă notificări
    if (!('Notification' in window)) {
      console.log('[UpdateNotifications] Browser does not support notifications');
      return;
    }

    // Cere permisiune pentru notificări
    const requestNotificationPermission = async () => {
      if (Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          console.log('[UpdateNotifications] Permission:', permission);
        } catch (error) {
          console.error('[UpdateNotifications] Error requesting permission:', error);
        }
      }
    };

    requestNotificationPermission();

    // Monitorizează pentru actualizări
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Verifică periodic pentru actualizări
        const checkForUpdates = async () => {
          try {
            await registration.update();
            
            if (registration.waiting || registration.installing) {
              setHasUpdate(true);
              
              // Trimite notificare dacă permisiunea e acordată
              if (Notification.permission === 'granted') {
                const notification = new Notification('Actualizare Disponibilă! 🎉', {
                  body: 'O nouă versiune a aplicației este gata. Apasă pentru a actualiza.',
                  icon: '/icon-192.png',
                  badge: '/icon-192.png',
                  tag: 'app-update',
                  requireInteraction: true,
                });

                notification.onclick = () => {
                  window.focus();
                  notification.close();
                  // Trigger update
                  if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                  }
                };
              } else {
                // Fallback la toast dacă nu avem permisiune
                toast.info('🎉 Actualizare disponibilă!', {
                  description: 'O nouă versiune a aplicației este gata.',
                  duration: 10000,
                });
              }
            }
          } catch (error) {
            console.error('[UpdateNotifications] Check failed:', error);
          }
        };

        // Verificare inițială
        checkForUpdates();

        // Event listeners - rely on native Service Worker events instead of aggressive polling
        registration.addEventListener('updatefound', () => {
          console.log('[UpdateNotifications] Update found!');
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setHasUpdate(true);
                
                if (Notification.permission === 'granted') {
                  new Notification('Actualizare Gata! ✅', {
                    body: 'Aplicația a fost actualizată. Apasă pentru a reîncărca.',
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'app-update-ready',
                    requireInteraction: true,
                  });
                }
              }
            });
          }
        });
      });
    }
  }, []);

  return { hasUpdate };
}
