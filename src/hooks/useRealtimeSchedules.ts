import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppActivity } from './useAppActivity';

/**
 * Realtime updates pentru programările săptămânale - optimizat pentru baterie
 * Invalidează automat listele relevante la INSERT/UPDATE/DELETE
 */
export const useRealtimeSchedules = (enabled: boolean = true) => {
  const queryClient = useQueryClient();
  const { isActive } = useAppActivity();

  useEffect(() => {
    if (!enabled) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let channel: any = null;

    const setupRealtime = () => {
      // Cleanup existing
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);

      if (isActive) {
        // Când activ: realtime complet
        channel = supabase
          .channel('weekly-schedules-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'weekly_schedules' },
            () => {
              queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
              queryClient.invalidateQueries({ queryKey: ['my-schedules'] });
            }
          )
          .subscribe();
      } else {
        // Când inactiv: polling la 1 minut
        pollInterval = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
          queryClient.invalidateQueries({ queryKey: ['my-schedules'] });
        }, 60000);
      }
    };

    setupRealtime();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, isActive]);
};