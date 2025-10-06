import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { isIOSPWA, forceRefreshApp, activateWaitingServiceWorker } from '@/lib/iosPwaUpdate';
import { iosStorage } from '@/lib/iosStorage';

const APP_VERSION_KEY = 'app_version';
const CURRENT_VERSION = Date.now().toString(); // Folosește timestamp ca versiune

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateType, setUpdateType] = useState<'pwa' | 'ios'>('pwa');

  useEffect(() => {
    const checkVersion = async () => {
      // Verifică versiunea salvată
      const savedVersion = await iosStorage.getItem(APP_VERSION_KEY);
      
      if (!savedVersion) {
        // Prima deschidere, salvează versiunea
        await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      }
    };

    checkVersion();

    if ('serviceWorker' in navigator) {
      // Verifică dacă există un update disponibil
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Verifică pentru actualizări la fiecare 5 secunde (mai agresiv)
        const checkForUpdates = () => {
          reg.update().catch((err) => {
            console.debug('Update check failed:', err);
          });
        };

        // Verificare inițială
        checkForUpdates();

        // Verificare periodică mai frecventă
        const interval = setInterval(checkForUpdates, 5000);

        // Cleanup
        return () => clearInterval(interval);
      });

      // Listen pentru updatefound
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Un nou service worker a preluat controlul
        if (!showUpdate) {
          setShowUpdate(true);
          setUpdateType('pwa');
          toast.info('Actualizare disponibilă! 🎉', {
            description: 'O nouă versiune a aplicației este gata de instalare.',
            duration: 10000,
          });
        }
      });
    }

    // Check pentru waiting worker la mount
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          setShowUpdate(true);
          setUpdateType('pwa');
          setRegistration(reg);
        }
      });
    }

    // Pentru iOS PWA - verificare periodică forțată
    if (isIOSPWA()) {
      const iosCheckInterval = setInterval(async () => {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.waiting || reg?.installing) {
            setShowUpdate(true);
            setUpdateType('ios');
            setRegistration(reg);
          }
        } catch (error) {
          console.debug('iOS update check failed:', error);
        }
      }, 3000); // Verificare la fiecare 3 secunde pe iOS

      return () => clearInterval(iosCheckInterval);
    }
  }, [showUpdate]);

  const handleUpdate = async () => {
    if (isIOSPWA() && updateType === 'ios') {
      // Pentru iOS PWA, folosește forceRefreshApp
      toast.info('Se actualizează aplicația...');
      await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      await forceRefreshApp();
    } else if (registration?.waiting) {
      // Pentru PWA standard
      toast.info('Se instalează actualizarea...');
      activateWaitingServiceWorker();
    } else {
      // Fallback: doar reîncarcă pagina
      toast.info('Se reîncarcă aplicația...');
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <Card className="fixed bottom-20 left-4 right-4 z-50 shadow-lg border-primary animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1">
            <p className="font-semibold text-sm">🎉 Actualizare disponibilă</p>
            <p className="text-xs text-muted-foreground mt-1">
              O nouă versiune a aplicației este pregătită. {isIOSPWA() ? 'Apasă pentru a actualiza complet aplicația iOS.' : 'Apasă pentru a actualiza.'}
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleUpdate}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Actualizează acum
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUpdate(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
