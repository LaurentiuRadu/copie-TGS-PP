import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { STALE_TIME } from '@/lib/queryConfig';
import { format } from 'date-fns';

export interface DailyTimesheet {
  id: string;
  employee_id: string;
  work_date: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  hours_leave: number;
  hours_medical_leave: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username: string | null;
    full_name: string | null;
  };
}

/**
 * Hook pentru a prelua pontajele zilnice pentru o anumită dată
 * ✅ Deduplication activată prin React Query
 * ✅ Optimized cu index: idx_daily_timesheets_work_date (if exists)
 * 💡 Consider adding: CREATE INDEX idx_daily_timesheets_work_date ON daily_timesheets(work_date);
 * ✅ FIXED: Folosește format() în loc de toISOString() pentru a evita timezone slippage
 */
export const useDailyTimesheets = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: QUERY_KEYS.dailyTimesheets(date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_timesheets')
        .select(`
          *,
          profiles:employee_id!inner (
            id,
            username,
            full_name
          )
        `)
        .eq('work_date', dateStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DailyTimesheet[];
    },
    staleTime: STALE_TIME.ADMIN_DATA,
  });
};

/**
 * Hook pentru a prelua pontajele zilnice ale utilizatorului curent pentru o lună
 * ✅ Deduplication activată prin React Query
 * ✅ Optimized cu index: idx_daily_timesheets_employee_work_date (if exists)
 * 💡 Consider adding: CREATE INDEX idx_daily_timesheets_employee_work_date ON daily_timesheets(employee_id, work_date DESC);
 * ✅ FIXED: Folosește format() în loc de toISOString() pentru a evita timezone slippage
 */
export const useMyDailyTimesheets = (userId: string | undefined, month: Date) => {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  const startDate = format(startOfMonth, 'yyyy-MM-dd');
  const endDate = format(endOfMonth, 'yyyy-MM-dd');

  return useQuery({
    queryKey: QUERY_KEYS.myDailyTimesheets(userId, month),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('daily_timesheets')
        .select(`
          *,
          profiles:employee_id!inner (
            id,
            username,
            full_name
          )
        `)
        .eq('employee_id', userId)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: false });

      if (error) throw error;
      return data as DailyTimesheet[];
    },
    enabled: !!userId,
    staleTime: STALE_TIME.USER_TRACKING,
  });
};

/**
 * Hook pentru a prelua pontajele săptămânale pentru toate angajații
 * ✅ Deduplication activată prin React Query
 * ✅ Optimized cu index: idx_daily_timesheets_work_date (if exists)
 * 💡 Consider adding: CREATE INDEX idx_daily_timesheets_work_date_range ON daily_timesheets(work_date) WHERE work_date >= NOW() - INTERVAL '7 days';
 * ✅ FIXED: Folosește format() în loc de toISOString() pentru a evita timezone slippage
 */
export const useWeeklyTimesheets = (weekStart: Date, userId?: string) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(weekEnd, 'yyyy-MM-dd');

  return useQuery({
    queryKey: QUERY_KEYS.weeklyTimesheets(weekStart),
    queryFn: async () => {
      let query = supabase
        .from('daily_timesheets')
        .select(`
          *,
          profiles:employee_id!inner (
            id,
            username,
            full_name
          )
        `)
        .gte('work_date', startDate)
        .lte('work_date', endDate);

      if (userId) {
        query = query.eq('employee_id', userId);
      }

      const { data, error } = await query.order('work_date', { ascending: true });

      if (error) throw error;
      return data as DailyTimesheet[];
    },
    staleTime: STALE_TIME.ADMIN_DATA,
  });
};
