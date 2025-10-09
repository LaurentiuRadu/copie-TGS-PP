import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { STALE_TIME } from '@/lib/queryConfig';

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
 */
export const useDailyTimesheets = (date: Date) => {
  const dateStr = date.toISOString().split('T')[0];

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
 */
export const useMyDailyTimesheets = (userId: string | undefined, month: Date) => {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = endOfMonth.toISOString().split('T')[0];

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
 */
export const useWeeklyTimesheets = (weekStart: Date, userId?: string) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const startDate = weekStart.toISOString().split('T')[0];
  const endDate = weekEnd.toISOString().split('T')[0];

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
