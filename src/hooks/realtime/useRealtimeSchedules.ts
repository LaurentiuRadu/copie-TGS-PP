import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Realtime updates pentru programările săptămânale
 * Invalidează automat listele relevante la INSERT/UPDATE/DELETE
 */
export const useRealtimeSchedules = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
