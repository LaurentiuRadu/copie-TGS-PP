import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface ActiveTimeEntry {
  id: string;
  clock_in_time: string;
  user_id: string;
  notes: string | null;
}

export const useActiveTimeEntry = (userId: string | undefined) => {
  const [hasNotified12h, setHasNotified12h] = useState(false);

  const { data: activeEntry, isLoading, refetch } = useQuery({
    queryKey: ['active-time-entry', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('time_entries')
        .select('id, clock_in_time, user_id, notes')
        .eq('user_id', userId)
        .is('clock_out_time', null)
        .order('clock_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ActiveTimeEntry | null;
    },
    enabled: !!userId,
    // ✅ ELIMINAT polling interval - folosim doar realtime subscription
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // ✅ Structural sharing previne re-render-uri când datele sunt identice
    structuralSharing: true,
  });

  // ✅ Realtime subscription pentru active time entries
  useEffect(() => {
    if (!userId) return;

    logger.info('[useActiveTimeEntry] Setting up realtime subscription for user:', userId);

    const channel = supabase
      .channel(`active-time-entry-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          logger.info('[useActiveTimeEntry] Realtime update:', payload.eventType);
          // Refetch doar când se schimbă ceva relevant pentru active entry
          refetch();
        }
      )
      .subscribe();

    return () => {
      logger.info('[useActiveTimeEntry] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  // Listener pentru când aplicația devine vizibilă din nou (crucial pentru iOS)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userId) {
        logger.info('[useActiveTimeEntry] App became visible, refetching active entry...');
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, refetch]);

  // ✅ Calcul elapsed time memoizat pentru a preveni re-calculări inutile
  const elapsed = useMemo(() => {
    if (!activeEntry) return { hours: 0, minutes: 0, total: 0 };

    const clockIn = new Date(activeEntry.clock_in_time);
    const now = new Date();
    const diff = now.getTime() - clockIn.getTime();
    const totalMinutes = Math.floor(diff / 60000);
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      total: totalMinutes
    };
  }, [activeEntry]);

  // ✅ Notificare la 12h - verificare doar când activeEntry se schimbă
  useEffect(() => {
    if (!activeEntry) {
      setHasNotified12h(false);
      return;
    }

    const checkAndNotify = () => {
      const clockIn = new Date(activeEntry.clock_in_time);
      const now = new Date();
      const diff = now.getTime() - clockIn.getTime();
      const hours = Math.floor(diff / (60000 * 60));

      if (hours >= 12 && !hasNotified12h) {
        toast.warning('Atenție: Pontaj activ de peste 12 ore!', {
          description: 'Nu uita să închizi pontajul la finalul turei.',
          duration: 10000,
          action: {
            label: 'Vezi Pontaj',
            onClick: () => window.location.href = '/mobile'
          }
        });
        setHasNotified12h(true);
      }
    };

    // Verifică imediat
    checkAndNotify();

    // Verifică la fiecare 30 minute pentru notificarea de 12h
    const checkInterval = setInterval(checkAndNotify, 30 * 60 * 1000);

    return () => clearInterval(checkInterval);
  }, [activeEntry, hasNotified12h]);

  return {
    activeEntry,
    isLoading,
    elapsed,
    hasActiveEntry: !!activeEntry,
    refetch
  };
};
