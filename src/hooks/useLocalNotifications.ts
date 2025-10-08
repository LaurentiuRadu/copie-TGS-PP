import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

// Types for Local Notifications
interface ScheduleNotificationOptions {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
  extra?: Record<string, any>;
}

interface NotificationPermissionStatus {
  display: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
}

interface PendingNotification {
  id: number;
  title: string;
  body: string;
  schedule: {
    at: Date;
  };
}

export function useLocalNotifications() {
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'>('prompt');

  // Check if running on native platform
  useEffect(() => {
    const checkPlatform = () => {
      const isNative = !!(window as any).Capacitor;
      setIsNativePlatform(isNative);
      
      if (!isNative) {
        console.log('[LocalNotifications] Running on web - notifications will be simulated');
      }
    };
    
    checkPlatform();
  }, []);

  // Request notification permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform) {
      console.log('[LocalNotifications] Web platform - simulating permission grant');
      toast({
        title: "Web Platform",
        description: "Notificările locale funcționează doar pe dispozitive mobile",
      });
      return false;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      console.log('[LocalNotifications] Requesting permissions...');
      const result = await LocalNotifications.requestPermissions();
      
      setPermissionStatus(result.display);
      
      if (result.display === 'granted') {
        console.log('[LocalNotifications] Permissions granted');
        toast({
          title: "✅ Permisiuni acordate",
          description: "Poți primi notificări locale",
        });
        return true;
      } else {
        console.log('[LocalNotifications] Permissions denied:', result.display);
        toast({
          title: "❌ Permisiuni refuzate",
          description: "Nu poți primi notificări locale",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('[LocalNotifications] Error requesting permissions:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut solicita permisiunile pentru notificări",
        variant: "destructive",
      });
      return false;
    }
  }, [isNativePlatform]);

  // Check current permission status
  const checkPermissions = useCallback(async (): Promise<NotificationPermissionStatus | null> => {
    if (!isNativePlatform) {
      console.log('[LocalNotifications] Web platform - cannot check permissions');
      return null;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.checkPermissions();
      setPermissionStatus(result.display);
      console.log('[LocalNotifications] Current permission status:', result.display);
      return result;
    } catch (error) {
      console.error('[LocalNotifications] Error checking permissions:', error);
      return null;
    }
  }, [isNativePlatform]);

  // Schedule a notification
  const scheduleNotification = useCallback(async (options: ScheduleNotificationOptions): Promise<boolean> => {
    if (!isNativePlatform) {
      console.log('[LocalNotifications] Web - Simulated notification:', options);
      toast({
        title: options.title,
        description: `${options.body} (simulat - doar pe mobile)`,
      });
      return false;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Check permissions first
      const perms = await LocalNotifications.checkPermissions();
      if (perms.display !== 'granted') {
        console.log('[LocalNotifications] Missing permissions - requesting...');
        const granted = await requestPermissions();
        if (!granted) return false;
      }

      console.log('[LocalNotifications] Scheduling notification:', {
        id: options.id,
        title: options.title,
        at: options.scheduleAt.toISOString(),
      });

      await LocalNotifications.schedule({
        notifications: [
          {
            id: options.id,
            title: options.title,
            body: options.body,
            schedule: {
              at: options.scheduleAt,
            },
            extra: options.extra,
            sound: 'beep.wav',
            smallIcon: 'ic_stat_icon_config_sample',
          },
        ],
      });

      toast({
        title: "🔔 Notificare programată",
        description: `"${options.title}" - ${options.scheduleAt.toLocaleTimeString('ro-RO')}`,
      });

      console.log('[LocalNotifications] Notification scheduled successfully');
      return true;
    } catch (error) {
      console.error('[LocalNotifications] Error scheduling notification:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut programa notificarea",
        variant: "destructive",
      });
      return false;
    }
  }, [isNativePlatform, requestPermissions]);

  // Cancel a specific notification
  const cancelNotification = useCallback(async (id: number): Promise<boolean> => {
    if (!isNativePlatform) {
      console.log('[LocalNotifications] Web - Cannot cancel notification:', id);
      return false;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      console.log('[LocalNotifications] Cancelling notification:', id);
      await LocalNotifications.cancel({
        notifications: [{ id }],
      });

      toast({
        title: "🚫 Notificare anulată",
        description: `Notificarea #${id} a fost anulată`,
      });

      console.log('[LocalNotifications] Notification cancelled');
      return true;
    } catch (error) {
      console.error('[LocalNotifications] Error cancelling notification:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut anula notificarea",
        variant: "destructive",
      });
      return false;
    }
  }, [isNativePlatform]);

  // Cancel all notifications
  const cancelAllNotifications = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform) {
      console.log('[LocalNotifications] Web - Cannot cancel all notifications');
      return false;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      console.log('[LocalNotifications] Cancelling all notifications');
      const pending = await LocalNotifications.getPending();
      
      if (pending.notifications.length === 0) {
        toast({
          title: "ℹ️ Nicio notificare",
          description: "Nu există notificări programate",
        });
        return true;
      }

      await LocalNotifications.cancel({
        notifications: pending.notifications,
      });

      toast({
        title: "🚫 Toate notificările anulate",
        description: `${pending.notifications.length} notificări anulate`,
      });

      console.log('[LocalNotifications] All notifications cancelled');
      return true;
    } catch (error) {
      console.error('[LocalNotifications] Error cancelling all notifications:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut anula notificările",
        variant: "destructive",
      });
      return false;
    }
  }, [isNativePlatform]);

  // Get pending notifications
  const getPendingNotifications = useCallback(async (): Promise<PendingNotification[]> => {
    if (!isNativePlatform) {
      console.log('[LocalNotifications] Web - No pending notifications');
      return [];
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      const result = await LocalNotifications.getPending();
      console.log('[LocalNotifications] Pending notifications:', result.notifications.length);
      
      return result.notifications as PendingNotification[];
    } catch (error) {
      console.error('[LocalNotifications] Error getting pending notifications:', error);
      return [];
    }
  }, [isNativePlatform]);

  return {
    isNativePlatform,
    permissionStatus,
    requestPermissions,
    checkPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getPendingNotifications,
  };
}
