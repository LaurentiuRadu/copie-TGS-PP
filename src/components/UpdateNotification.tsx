import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { isIOSPWA, activateWaitingServiceWorker } from '@/lib/iosPwaUpdate';
import { iosStorage } from '@/lib/iosStorage';
import { useBatteryOptimization } from '@/hooks/useBatteryOptimization';
import { supabase } from '@/integrations/supabase/client';

// Singleton guards pentru a preveni duplicate initialization
declare global {
  interface Window {
    __UPDATE_NOTIF_INIT__?: boolean;
  }
}

const APP_VERSION_KEY = 'app_version';
const CURRENT_VERSION = "10";
const DISMISSED_VERSION_KEY = 'dismissedAppVersion';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateType, setUpdateType] = useState<'pwa' | 'ios' | 'version'>('pwa');
  const [isDismissed, setIsDismissed] = useState(false);
  
  const { batteryInfo } = useBatteryOptimization();

  // Check versiune din DB - mai puțin frecvent
  const { data: latestVersion } = useQuery({
    queryKey: ['latestAppVersion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 6 * 60 * 60 * 1000, // Check every 6 hours
  });

  // Singleton initialization - runs only once per session
  useEffect(() => {
    // Guard: prevent duplicate initialization
    if (window.__UPDATE_NOTIF_INIT__) {
      return;
    }
    window.__UPDATE_NOTIF_INIT__ = true;

    let cancelled = false;

    const init = async () => {
      // Init version storage
      const savedVersion = await iosStorage.getItem(APP_VERSION_KEY);
      if (!savedVersion) {
        await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      }

      // One-time cleanup for old dismissed versions
      const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
      if (dismissedVersion && dismissedVersion !== "10") {
        localStorage.removeItem(DISMISSED_VERSION_KEY);
      }

      if ('serviceWorker' in navigator && !cancelled) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (cancelled) return;

          setRegistration(reg);

          // Event-driven approach: listen for updatefound
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              console.log('[UpdateNotification] Update found, new service worker installing');
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[UpdateNotification] New service worker installed and ready');
                  setShowUpdate(true);
                  setUpdateType('pwa');
                  setRegistration(reg);
                }
              });
            }
          });

          // Check if there's already a waiting SW
          if (reg.waiting) {
            console.log('[UpdateNotification] Service worker waiting, showing update prompt');
            setShowUpdate(true);
            setUpdateType('pwa');
            setRegistration(reg);
          }
        } catch (e) {
          console.debug('[UpdateNotification] Service worker not ready:', e);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      // Don't reset __UPDATE_NOTIF_INIT__ to maintain singleton behavior
    };
  }, []); // Empty deps - runs only once

  // Verifică versiune din DB
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
    if (dismissed === latestVersion?.version) {
      setIsDismissed(true);
    } else {
      setIsDismissed(false);
    }
  }, [latestVersion?.version]);

  // Arată update dacă versiunea din DB e mai nouă
  useEffect(() => {
    if (latestVersion && latestVersion.version !== CURRENT_VERSION && !isDismissed) {
      setShowUpdate(true);
      setUpdateType('version');
    }
  }, [latestVersion, isDismissed]);


  const handleUpdate = async () => {
    setShowUpdate(false);
    
    if (updateType === 'version') {
      toast.info('Se actualizează aplicația...');
      if (latestVersion?.version) {
        await iosStorage.setItem(APP_VERSION_KEY, latestVersion.version);
      }
      // registerServiceWorker will handle the reload via controllerchange
      setTimeout(() => window.location.reload(), 200);
    } else if (isIOSPWA()) {
      toast.info('Se actualizează aplicația...');
      await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      setTimeout(() => window.location.reload(), 200);
    } else if (registration?.waiting) {
      toast.info('Se instalează actualizarea...');
      // Send SKIP_WAITING message - registerServiceWorker will handle reload
      activateWaitingServiceWorker();
    } else {
      toast.info('Se reîncarcă aplicația...');
      setTimeout(() => window.location.reload(), 200);
    }
  };

  const handleDismiss = () => {
    if (updateType === 'version' && latestVersion?.version) {
      localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion.version);
      setIsDismissed(true);
    }
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <Card className="fixed bottom-20 left-4 right-4 z-50 shadow-lg border-primary animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {updateType === 'version' ? (
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          ) : (
            <RefreshCw className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 animate-spin" />
          )}
          <div className="flex-1">
            <p className="font-semibold text-sm">🎉 Actualizare disponibilă</p>
            {updateType === 'version' && latestVersion ? (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Versiunea {latestVersion.version}</span> este disponibilă.
                  {' '}(Versiunea curentă: {CURRENT_VERSION})
                </p>
                {latestVersion.release_notes && (
                  <p className="text-xs text-primary mt-1">
                    📝 {latestVersion.release_notes}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                O nouă versiune a aplicației este pregătită. {isIOSPWA() ? 'Apasă pentru a actualiza complet aplicația iOS.' : 'Apasă pentru a actualiza.'}
              </p>
            )}
            {batteryInfo.isLowBattery && !batteryInfo.charging && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                ⚠️ Baterie scăzută ({Math.round(batteryInfo.level * 100)}%) - conectați la încărcare
              </p>
            )}
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
                onClick={handleDismiss}
                aria-label="Închide notificarea de actualizare"
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
