import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playDoubleNotificationSound } from '@/lib/notificationSound';
import { toast } from 'sonner';
import { useAppActivity } from './useAppActivity';

export const useScheduleNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const soundIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { isActive } = useAppActivity();

  // Fetch notifications
  const { data: notifications } = useQuery({
    queryKey: ['schedule-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('schedule_notifications')
        .select(`
          *,
          weekly_schedules (
            team_id,
            week_start_date,
            day_of_week,
            location,
            activity,
            vehicle,
            observations
          )
        `)
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Update unread count și gestionează sunetele recurente
  useEffect(() => {
    const newUnreadCount = notifications?.length || 0;
    setUnreadCount(newUnreadCount);

    // Curăță toate intervalele existente
    soundIntervalsRef.current.forEach(interval => clearInterval(interval));
    soundIntervalsRef.current.clear();

    // Creează intervale noi pentru fiecare notificare necitită DOAR dacă există notificări
    if (notifications && notifications.length > 0 && isActive) {
      notifications.forEach((notification) => {
        // Redă sunet la fiecare 2 minute pentru notificările necitite
        const intervalId = setInterval(() => {
          // Double-check că notificarea încă există
          if (soundIntervalsRef.current.has(notification.id)) {
            playDoubleNotificationSound();
          }
        }, 120000); // 2 minute = 120000ms

        soundIntervalsRef.current.set(notification.id, intervalId);
      });
    }

    // Cleanup când componenta se demontează sau notificările se schimbă
    return () => {
      soundIntervalsRef.current.forEach(interval => clearInterval(interval));
      soundIntervalsRef.current.clear();
    };
  }, [notifications, isActive]);

  // Mark as read mutation - oprește și sunetul recurent
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      // Oprește intervalul de sunet pentru notificarea respectivă
      const intervalId = soundIntervalsRef.current.get(notificationId);
      if (intervalId) {
        clearInterval(intervalId);
        soundIntervalsRef.current.delete(notificationId);
      }

      const { error } = await supabase
        .from('schedule_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
    }
  });

  // Realtime subscription - optimizat pentru baterie
  useEffect(() => {
    if (!user) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let channel: any = null;

    const setupRealtime = () => {
      // Cleanup existing
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);

      if (isActive) {
        // Când activ: realtime complet
        channel = supabase
          .channel('schedule-notifications-changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'schedule_notifications',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
              playDoubleNotificationSound();
              toast.info('Programare nouă primită!', {
                description: 'Verifică notificările pentru detalii.',
                duration: 5000,
              });
            }
          )
          .subscribe();
      } else {
        // Când inactiv: polling la 1 minut
        pollInterval = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
        }, 60000);
      }
    };

    setupRealtime();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, queryClient, isActive]);

  return {
    notifications,
    unreadCount,
    markAsRead
  };
};
