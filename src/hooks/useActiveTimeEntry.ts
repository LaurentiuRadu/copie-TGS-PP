import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
    refetchInterval: 5 * 60 * 1000, // Verifică la fiecare 5 minute
    refetchOnWindowFocus: true,
  });

  // Calcul elapsed time
  const getElapsedTime = () => {
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
  };

  const elapsed = getElapsedTime();

  // Notificare la 12h
  useEffect(() => {
    if (!activeEntry) {
      setHasNotified12h(false);
      return;
    }

    const { hours } = elapsed;

    // Notificare la 12h
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
  }, [activeEntry, elapsed.hours, hasNotified12h]);

  return {
    activeEntry,
    isLoading,
    elapsed,
    hasActiveEntry: !!activeEntry,
    refetch
  };
};
