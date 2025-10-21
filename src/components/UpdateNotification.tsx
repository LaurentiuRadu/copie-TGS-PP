import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { isIOSPWA, forceRefreshApp, activateWaitingServiceWorker } from '@/lib/iosPwaUpdate';
import { iosStorage } from '@/lib/iosStorage';
import { useBatteryOptimization } from '@/hooks/useBatteryOptimization';
import { useUpdateNotifications } from '@/hooks/useUpdateNotifications';
import { supabase } from '@/integrations/supabase/client';

const APP_VERSION_KEY = 'app_version';
const CURRENT_VERSION = "10"; // Actualizează manual după fiecare publish în package.json
const DISMISSED_VERSION_KEY = 'dismissedAppVersion';

// Helper pentru a verifica dacă suntem în program de lucru (05:00 - 24:00)
const isBusinessHours = (): boolean => {
  const currentHour = new Date().getHours();
  // Program lucru: 05:00 - 23:59 (true)
  // Noapte: 00:00 - 04:59 (false)
  return currentHour >= 5;
};

// Helper pentru interval adaptiv cu business hours
const getBusinessHoursInterval = (baseInterval: number): number => {
  if (!isBusinessHours()) {
    // Noapte: interval de 2 ore (minimal checks)
    return 2 * 60 * 60 * 1000;
  }
  return baseInterval;
};

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateType, setUpdateType] = useState<'pwa' | 'ios' | 'version'>('pwa');
  const [isDismissed, setIsDismissed] = useState(false);
  const controllerChangedRef = useRef(false);
  const suppressRef = useRef(false);
  
  const { batteryInfo, getRecommendedPollingInterval } = useBatteryOptimization();
  const { hasUpdate: notificationHasUpdate } = useUpdateNotifications();

  // Check versiune din DB
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
    refetchInterval: (query) => {
      if (!isBusinessHours()) {
        console.log('[UpdateNotification] Skipping DB check - outside business hours (00:00-05:00)');
        return false; // Oprește verificările
      }
      return 6 * 60 * 60 * 1000; // Check every 6 hours (05:00, 11:00, 17:00, 23:00)
    },
  });

  useEffect(() => {
    const checkVersion = async () => {
      const savedVersion = await iosStorage.getItem(APP_VERSION_KEY);
      if (!savedVersion) {
        await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      }
    };
    checkVersion();

    // Curățare one-time pentru versiuni vechi dismissed
    const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
    if (dismissedVersion && dismissedVersion !== "10") {
      localStorage.removeItem(DISMISSED_VERSION_KEY);
      console.log('[UpdateNotification] Cleared old dismissed version:', dismissedVersion);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Interval adaptiv bazat pe baterie ȘI business hours
        const updateCheckInterval = () => {
          const batteryInterval = getRecommendedPollingInterval();
          const finalInterval = getBusinessHoursInterval(batteryInterval);
          
          if (!isBusinessHours()) {
            console.log(`[UpdateNotification] Night mode - using 2h interval`);
          } else {
            console.log(`[UpdateNotification] Using ${finalInterval}ms interval (battery: ${Math.round(batteryInfo.level * 100)}%, charging: ${batteryInfo.charging})`);
          }
          
          return finalInterval;
        };

        const checkForUpdates = () => {
          // Nu verifica dacă bateria e critică și nu e în încărcare
          if (batteryInfo.isCriticalBattery && !batteryInfo.charging) {
            console.log('[UpdateNotification] Skipping check - critical battery');
            return;
          }
          
          // Nu verifica dacă suntem în afara business hours (00:00-05:00)
          if (!isBusinessHours()) {
            console.log('[UpdateNotification] Skipping check - outside business hours');
            return;
          }
          
          reg.update().catch((err) => {
            console.debug('Update check failed:', err);
          });
        };

        checkForUpdates();

        // Interval dinamic care se ajustează pe baterie
        let intervalId = setInterval(checkForUpdates, updateCheckInterval());
        
        // Reajustează intervalul când se schimbă bateria
        const batteryChangeInterval = setInterval(() => {
          clearInterval(intervalId);
          intervalId = setInterval(checkForUpdates, updateCheckInterval());
        }, 30000); // Verifică la 30s dacă trebuie schimbat intervalul

        return () => {
          clearInterval(intervalId);
          clearInterval(batteryChangeInterval);
        };
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Când noul SW devine controller, reîncărcăm o singură dată și ascundem cardul
        if (!controllerChangedRef.current) {
          controllerChangedRef.current = true;
          setShowUpdate(false);
          setTimeout(() => window.location.reload(), 100);
        }
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          setShowUpdate(true);
          setUpdateType('pwa');
          setRegistration(reg);
        }
      });
    }

    // Pentru iOS PWA - verificare mai puțin agresivă cu business hours
    if (isIOSPWA()) {
      // Verificare la 30 minute, doar în business hours
      const iosCheckInterval = setInterval(async () => {
        // Skip dacă baterie critică
        if (batteryInfo.isCriticalBattery && !batteryInfo.charging) {
          return;
        }
        
        // Skip dacă suntem în afara business hours (00:00-05:00)
        if (!isBusinessHours()) {
          console.log('[UpdateNotification] Skipping iOS check - outside business hours');
          return;
        }
        
        // Nu afișa update dacă utilizatorul nu e autentificat
        if (!window.location.pathname.includes('/auth')) {
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
        }
      }, 30 * 60 * 1000); // 30 minute

      return () => {
        clearInterval(iosCheckInterval);
      };
    }
  }, [showUpdate, batteryInfo, getRecommendedPollingInterval]);

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

  // Arată automat update dacă hook-ul de notificări a detectat unul
  useEffect(() => {
    if (notificationHasUpdate && !showUpdate && !suppressRef.current && !isDismissed) {
      setShowUpdate(true);
    }
  }, [notificationHasUpdate, showUpdate, isDismissed]);

  const handleUpdate = async () => {
    // Previne reapariția imediată a cardului
    suppressRef.current = true;
    setShowUpdate(false);
    
    // Scurt delay pentru feedback vizual
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (updateType === 'version') {
      toast.info('Se actualizează aplicația...');
      if (latestVersion?.version) {
        await iosStorage.setItem(APP_VERSION_KEY, latestVersion.version);
      }
      setTimeout(() => window.location.reload(), 200);
    } else if (isIOSPWA()) {
      toast.info('Se actualizează aplicația...');
      await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      setTimeout(() => window.location.reload(), 200);
    } else if (registration?.waiting) {
      toast.info('Se instalează actualizarea...');
      activateWaitingServiceWorker();
    } else {
      toast.info('Se reîncarcă aplicația...');
      setTimeout(() => window.location.reload(), 200);
    }
  };

  const handleDismiss = () => {
    suppressRef.current = true;
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
