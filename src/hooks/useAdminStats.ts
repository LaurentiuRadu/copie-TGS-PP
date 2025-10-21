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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const { data, error } = await supabase.functions.invoke('get-admin-stats', {
          method: 'GET',
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error('[useAdminStats] Error fetching stats:', error);
          throw new Error(error.message || 'Failed to fetch admin statistics');
        }

        return data as AdminStats;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Request timeout - statisticile nu au putut fi încărcate');
        }
        throw err;
      }
    },
    staleTime: STALE_TIME.ADMIN_DATA,
    refetchInterval: 60000, // Refresh every minute
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};
