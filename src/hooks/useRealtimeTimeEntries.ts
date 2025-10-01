import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook pentru real-time updates la pontaje
 * Detectează automat când se adaugă/modifică pontaje
 */
export const useRealtimeTimeEntries = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('time-entries-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'time_entries',
        },
        (payload) => {
          console.log('New time entry detected:', payload);
          // Invalidate toate queries legate de time entries
          queryClient.invalidateQueries({ queryKey: ['time-entries'] });
          queryClient.invalidateQueries({ queryKey: ['my-time-entries'] });
          
          // Notificare subtilă pentru admin
          if (window.location.pathname.includes('/time-entries')) {
            toast.info('Pontaj nou adăugat', {
              duration: 3000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'time_entries',
        },
        (payload) => {
          console.log('Time entry updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['time-entries'] });
          queryClient.invalidateQueries({ queryKey: ['my-time-entries'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
