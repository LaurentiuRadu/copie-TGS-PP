import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_photo_url: string | null;
  clock_out_photo_url: string | null;
  device_id: string | null;
  notes: string | null;
  user_id: string;
  profiles: {
    full_name: string | null;
  } | null;
  time_entry_segments: Array<{
    segment_type: string;
    hours_decimal: number;
    multiplier: number;
    start_time: string;
    end_time: string;
  }>;
}

export const useOptimizedTimeEntries = (selectedDate: Date) => {
  return useQuery({
    queryKey: ['time-entries', selectedDate.toISOString()],
    queryFn: async () => {
      const startOfDayTime = startOfDay(selectedDate);
      const endOfDayTime = endOfDay(selectedDate);

      // Query optimizat fără JOIN complex
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          time_entry_segments(*)
        `)
        .gte('clock_in_time', startOfDayTime.toISOString())
        .lte('clock_in_time', endOfDayTime.toISOString())
        .order('clock_in_time', { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) return [];

      // Fetch profiles separat (batched)
      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(entry => ({
        ...entry,
        profiles: profilesMap.get(entry.user_id) || null
      })) as TimeEntry[];
    },
    staleTime: 60000, // 60 secunde - date fresh pentru admin (optimizat)
    gcTime: 60000, // 1 minut in cache
    refetchOnWindowFocus: true, // Refresh când user revine pe tab
  });
};

export const useOptimizedMyTimeEntries = (userId: string | undefined, selectedMonth: Date) => {
  return useQuery({
    queryKey: ['my-time-entries', userId, selectedMonth.toISOString()],
    queryFn: async () => {
      if (!userId) {
        console.log('[useOptimizedMyTimeEntries] No userId provided');
        return [];
      }

      const startOfMonthTime = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endOfMonthTime = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);

      console.log('[useOptimizedMyTimeEntries] Query params:', {
        userId,
        selectedMonth: selectedMonth.toISOString(),
        startOfMonthTime: startOfMonthTime.toISOString(),
        endOfMonthTime: endOfMonthTime.toISOString()
      });

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          time_entry_segments(*)
        `)
        .eq('user_id', userId)
        .gte('clock_in_time', startOfMonthTime.toISOString())
        .lte('clock_in_time', endOfMonthTime.toISOString())
        .order('clock_in_time', { ascending: false });

      if (error) {
        console.error('[useOptimizedMyTimeEntries] Error:', error);
        throw error;
      }
      
      console.log('[useOptimizedMyTimeEntries] Data fetched:', data?.length || 0, 'entries');
      return data || [];
    },
    enabled: !!userId,
    staleTime: 30000, // 30 secunde
    gcTime: 5 * 60 * 1000, // 5 minute
  });
};
