import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Verifică dacă există un update disponibil
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Verifică pentru actualizări la fiecare 10 secunde
        const checkForUpdates = () => {
          reg.update().catch((err) => {
            console.debug('Update check failed:', err);
          });
        };

        // Verificare inițială
        checkForUpdates();

        // Verificare periodică
        const interval = setInterval(checkForUpdates, 10000);

        // Cleanup
        return () => clearInterval(interval);
      });

      // Listen pentru updatefound
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Un nou service worker a preluat controlul
        if (!showUpdate) {
          setShowUpdate(true);
          toast.info('Actualizare disponibilă!', {
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
          setRegistration(reg);
        }
      });
    }
  }, [showUpdate]);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Trimite mesaj către service worker să preia controlul
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Așteaptă să preia controlul și reîncarcă
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } else {
      // Fallback: doar reîncarcă pagina
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <Card className="fixed bottom-20 left-4 right-4 z-50 shadow-lg border-primary animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Actualizare disponibilă</p>
            <p className="text-xs text-muted-foreground mt-1">
              O nouă versiune a aplicației este pregătită. Apasă pentru a actualiza.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleUpdate}
                className="flex-1"
              >
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
