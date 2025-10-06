import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { isIOSPWA, forceRefreshApp, activateWaitingServiceWorker } from '@/lib/iosPwaUpdate';
import { iosStorage } from '@/lib/iosStorage';
import { useBatteryOptimization } from '@/hooks/useBatteryOptimization';
import { useUpdateNotifications } from '@/hooks/useUpdateNotifications';

const APP_VERSION_KEY = 'app_version';
const CURRENT_VERSION = Date.now().toString();

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateType, setUpdateType] = useState<'pwa' | 'ios'>('pwa');
  
  const { batteryInfo, getRecommendedPollingInterval } = useBatteryOptimization();
  const { hasUpdate: notificationHasUpdate } = useUpdateNotifications();

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

  // Arată automat update dacă hook-ul de notificări a detectat unul
  useEffect(() => {
    if (notificationHasUpdate && !showUpdate) {
      setShowUpdate(true);
    }
  }, [notificationHasUpdate, showUpdate]);

  const handleUpdate = async () => {
    if (isIOSPWA() && updateType === 'ios') {
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
