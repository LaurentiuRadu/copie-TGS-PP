import { useEffect, useState } from 'react';
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
const CURRENT_VERSION = "1.0.0"; // Actualizează manual după fiecare publish în package.json
const DISMISSED_VERSION_KEY = 'dismissedAppVersion';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateType, setUpdateType] = useState<'pwa' | 'ios' | 'version'>('pwa');
  const [isDismissed, setIsDismissed] = useState(false);
  
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
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  });

  useEffect(() => {
    const checkVersion = async () => {
      const savedVersion = await iosStorage.getItem(APP_VERSION_KEY);
      if (!savedVersion) {
        await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      }
    };
    checkVersion();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Interval adaptiv bazat pe baterie
        const updateCheckInterval = () => {
          const interval = getRecommendedPollingInterval();
          console.log(`[UpdateNotification] Using ${interval}ms interval (battery: ${Math.round(batteryInfo.level * 100)}%, charging: ${batteryInfo.charging})`);
          return interval;
        };

        const checkForUpdates = () => {
          // Nu verifica dacă bateria e critică și nu e în încărcare
          if (batteryInfo.isCriticalBattery && !batteryInfo.charging) {
            console.log('[UpdateNotification] Skipping check - critical battery');
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
        if (!showUpdate) {
          setShowUpdate(true);
          setUpdateType('pwa');
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

    // Pentru iOS PWA - verificare adaptivă
    if (isIOSPWA()) {
      let iosCheckInterval: NodeJS.Timeout;
      
      const setupIOSCheck = () => {
        const interval = getRecommendedPollingInterval();
        
        iosCheckInterval = setInterval(async () => {
          if (batteryInfo.isCriticalBattery && !batteryInfo.charging) {
            return;
          }
          
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
        }, interval);
      };

      setupIOSCheck();
      
      // Reajustează intervalul când bateria se schimbă
      const batteryMonitor = setInterval(() => {
        clearInterval(iosCheckInterval);
        setupIOSCheck();
      }, 30000);

      return () => {
        clearInterval(iosCheckInterval);
        clearInterval(batteryMonitor);
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
    if (notificationHasUpdate && !showUpdate) {
      setShowUpdate(true);
    }
  }, [notificationHasUpdate, showUpdate]);

  const handleUpdate = async () => {
    if (updateType === 'version') {
      // Actualizare versiune din DB - doar reload
      toast.info('Se actualizează aplicația...');
      if (latestVersion?.version) {
        await iosStorage.setItem(APP_VERSION_KEY, latestVersion.version);
      }
      window.location.reload();
    } else if (isIOSPWA() && updateType === 'ios') {
      toast.info('Se actualizează aplicația...');
      await iosStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
      await forceRefreshApp();
    } else if (registration?.waiting) {
      toast.info('Se instalează actualizarea...');
      activateWaitingServiceWorker();
    } else {
      toast.info('Se reîncarcă aplicația...');
      window.location.reload();
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
