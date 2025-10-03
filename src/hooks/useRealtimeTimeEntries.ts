import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppActivity } from './useAppActivity';

/**
 * Hook pentru real-time updates la pontaje - optimizat pentru baterie
 * Detectează automat când se adaugă/modifică pontaje
 */
export const useRealtimeTimeEntries = (enabled: boolean = true) => {
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
          .channel('time-entries-changes')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'time_entries' },
            () => {
              queryClient.invalidateQueries({ queryKey: ['time-entries'] });
              queryClient.invalidateQueries({ queryKey: ['my-time-entries'] });
              
              if (window.location.pathname.includes('/time-entries')) {
                toast.info('Pontaj nou adăugat', { duration: 3000 });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'time_entries' },
            () => {
              queryClient.invalidateQueries({ queryKey: ['time-entries'] });
              queryClient.invalidateQueries({ queryKey: ['my-time-entries'] });
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'time_entry_segments' },
            () => {
              queryClient.invalidateQueries({ queryKey: ['time-entries'] });
              queryClient.invalidateQueries({ queryKey: ['my-time-entries'] });
            }
          )
          .subscribe();
      } else {
        // Când inactiv: polling la 1 minut
        pollInterval = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ['time-entries'] });
          queryClient.invalidateQueries({ queryKey: ['my-time-entries'] });
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
