import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { STALE_TIME } from '@/lib/queryConfig';

interface AdminStats {
  totalEmployees: number;
  activeToday: number;
  pendingVacations: number;
  pendingCorrections: number;
  avgHours: string;
}

export const useAdminStats = () => {
  return useQuery({
    queryKey: QUERY_KEYS.adminStatsBatch(),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-admin-stats', {
        method: 'GET',
      });

      if (error) throw error;
      return data as AdminStats;
    },
    staleTime: STALE_TIME.ADMIN_DATA,
    refetchInterval: 60000, // Refresh every minute
  });
};
