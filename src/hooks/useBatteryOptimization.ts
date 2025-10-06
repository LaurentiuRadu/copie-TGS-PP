import { useEffect, useState } from 'react';

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(type: 'chargingchange' | 'levelchange', listener: () => void): void;
  removeEventListener(type: 'chargingchange' | 'levelchange', listener: () => void): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
  isLowBattery: boolean;
  isCriticalBattery: boolean;
  canClockOut: boolean;
}

const LOW_BATTERY_THRESHOLD = 0.20; // 20%
const CRITICAL_BATTERY_THRESHOLD = 0.10; // 10%

export function useBatteryOptimization() {
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo>({
    level: 1,
    charging: true,
    isLowBattery: false,
    isCriticalBattery: false,
    canClockOut: true,
  });

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    
    if (!nav.getBattery) {
      console.log('[Battery] Battery API not supported');
      return;
    }

    let battery: BatteryManager | null = null;

    const updateBatteryInfo = (batteryManager: BatteryManager) => {
      const level = batteryManager.level;
      const charging = batteryManager.charging;
      const isLowBattery = level <= LOW_BATTERY_THRESHOLD && !charging;
      const isCriticalBattery = level <= CRITICAL_BATTERY_THRESHOLD && !charging;
      
      // Poate face clock-out doar dacă bateria nu e critică SAU dacă e în încărcare
      const canClockOut = !isCriticalBattery || charging;

      setBatteryInfo({
        level,
        charging,
        isLowBattery,
        isCriticalBattery,
        canClockOut,
      });

      console.log('[Battery] Status updated:', {
        level: `${Math.round(level * 100)}%`,
        charging,
        isLowBattery,
        isCriticalBattery,
        canClockOut,
      });
    };

    nav.getBattery().then((batteryManager) => {
      battery = batteryManager;
      updateBatteryInfo(batteryManager);

      // Listeners pentru schimbări
      const onChargingChange = () => updateBatteryInfo(batteryManager);
      const onLevelChange = () => updateBatteryInfo(batteryManager);

      batteryManager.addEventListener('chargingchange', onChargingChange);
      batteryManager.addEventListener('levelchange', onLevelChange);

      return () => {
        batteryManager.removeEventListener('chargingchange', onChargingChange);
        batteryManager.removeEventListener('levelchange', onLevelChange);
      };
    }).catch((error) => {
      console.error('[Battery] Error accessing battery:', error);
    });
  }, []);

  // Returnează interval recomandat pentru polling bazat pe baterie
  const getRecommendedPollingInterval = () => {
    if (batteryInfo.charging) {
      return 5000; // 5 secunde când e în încărcare
    }
    if (batteryInfo.isCriticalBattery) {
      return 60000; // 60 secunde când bateria e critică
    }
    if (batteryInfo.isLowBattery) {
      return 30000; // 30 secunde când bateria e scăzută
    }
    return 10000; // 10 secunde în condiții normale
  };

  return {
    batteryInfo,
    getRecommendedPollingInterval,
  };
}
