import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { STALE_TIME, CACHE_TIME } from '@/lib/queryConfig';

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  type: string;
  status: string;
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface VacationBalance {
  id: string;
  user_id: string;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  notes: string | null;
}

export const useOptimizedVacations = (userId: string | undefined, isAdmin: boolean) => {
  const queryClient = useQueryClient();

  // Fetch vacation balance for current year
  const currentYear = new Date().getFullYear();
  const { data: balance } = useQuery({
    queryKey: QUERY_KEYS.vacationBalance(userId, currentYear),
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('vacation_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      return data as VacationBalance | null;
    },
    enabled: !!userId,
    staleTime: STALE_TIME.STATIC_DATA,
    gcTime: CACHE_TIME.STABLE,
  });

  // Optimized query - simplificat fără JOIN complex
  const { data: requests = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.vacationRequests(),
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('vacation_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admins only see their own requests
      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles separat pentru admin (optimizat cu batching)
      if (isAdmin && data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return data.map(req => ({
          ...req,
          profiles: profilesMap.get(req.user_id) || null
        })) as VacationRequest[];
      }

      return data as VacationRequest[];
    },
    enabled: !!userId,
    staleTime: STALE_TIME.USER_TRACKING,
    gcTime: CACHE_TIME.STABLE,
  });

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: async (newRequest: {
      user_id: string;
      start_date: string;
      end_date: string;
      days_count: number;
      type: string;
      reason: string | null;
    }) => {
      const { error } = await supabase
        .from('vacation_requests')
        .insert([newRequest]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationRequests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationBalance() });
      toast.success('Cerere trimisă cu succes');
    },
    onError: (error: any) => {
      console.error('Error creating request:', error);
      toast.error('Eroare la crearea cererii');
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNotes,
      reviewedBy,
    }: {
      id: string;
      status: 'approved' | 'rejected' | 'withdrawn';
      adminNotes?: string;
      reviewedBy: string;
    }) => {
      // Update vacation request status
      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status,
          admin_notes: adminNotes || null,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // If withdrawn and type is 'vacation' (CO), remove from daily_timesheets
      if (status === 'withdrawn') {
        const request = requests.find(r => r.id === id);
        if (request && request.type === 'vacation' && request.status === 'approved') {
          console.log(`[Vacation Withdrawal] 🔄 Withdrawing request: ${id}`);
          
          try {
            const { data, error: withdrawError } = await supabase.functions.invoke('withdraw-approved-vacation', {
              body: {
                request_id: id,
                reason: adminNotes || 'Retras de utilizator'
              }
            });

            if (withdrawError) {
              console.error('[Vacation Withdrawal] ❌ Edge function error:', withdrawError);
              throw new Error(`Eroare la retragere: ${withdrawError.message}`);
            }

            if (data?.success === false || data?.days_failed > 0) {
              console.error('[Vacation Withdrawal] ⚠️ Partial failure:', data);
              throw new Error(`Retragere parțială: ${data.days_removed}/${data.total_days} zile eliminate. ${data.days_failed} eșuate.`);
            }

            console.log(`[Vacation Withdrawal] ✅ Successfully withdrawn ${data.days_removed} days`);
            return { request, withdrawResult: data };
          } catch (error: any) {
            console.error('[Vacation Withdrawal] ❌ Withdrawal failed:', error);
            throw error;
          }
        }
      }

      // If approved and type is 'vacation' (CO), auto-write to daily_timesheets
      if (status === 'approved') {
        const request = requests.find(r => r.id === id);
        if (request && request.type === 'vacation') {
          console.log(`[Vacation Approval] ✅ Request approved: ${id}`);
          console.log(`[Vacation Approval] 🔄 Processing ${request.days_count} days to timesheet...`);
          
          try {
            const { data, error: processError } = await supabase.functions.invoke('process-approved-vacation', {
              body: {
                request_id: id,
                user_id: request.user_id,
                start_date: request.start_date,
                end_date: request.end_date,
              }
            });

            if (processError) {
              console.error('[Vacation Approval] ❌ Edge function error:', processError);
              throw new Error(`Cerere aprobată, dar eroare la procesare: ${processError.message}`);
            }

            if (data?.success === false || data?.days_failed > 0) {
              console.error('[Vacation Approval] ⚠️ Partial failure:', data);
              throw new Error(`Procesare parțială: ${data.days_processed}/${data.total_days} zile adăugate. ${data.days_failed} eșuate.`);
            }

            console.log(`[Vacation Approval] ✅ Successfully processed ${data.days_processed} days`);
            return { request, processResult: data };
          } catch (error: any) {
            console.error('[Vacation Approval] ❌ Processing failed:', error);
            throw error;
          }
        }
      }

      return { request: requests.find(r => r.id === id) };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationRequests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationBalance() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
      const request = result?.request;
      const processResult = result?.processResult;
      const withdrawResult = result?.withdrawResult;
      
      if (variables.status === 'withdrawn' && request?.type === 'vacation') {
        if (withdrawResult?.success) {
          toast.success(`✅ Cerere CO retrasă! ${withdrawResult.days_removed} zile eliminate din pontaj`);
        } else if (withdrawResult?.days_removed > 0) {
          toast.success(`⚠️ Retragere parțială: ${withdrawResult.days_removed}/${withdrawResult.total_days} zile eliminate`);
        }
      } else if (variables.status === 'approved' && request?.type === 'vacation') {
        if (processResult?.success) {
          toast.success(`✅ Cerere CO aprobată! ${processResult.days_processed} zile (8h/zi) adăugate în pontaj`);
        } else if (processResult?.days_processed > 0) {
          toast.success(`⚠️ Cerere aprobată parțial: ${processResult.days_processed}/${processResult.total_days} zile procesate`);
        }
      } else {
        toast.success(
          variables.status === 'approved' ? '✅ Cerere aprobată' : 
          variables.status === 'rejected' ? '❌ Cerere respinsă' :
          '✅ Cerere retrasă'
        );
      }
    },
    onError: (error: any) => {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Eroare la actualizarea cererii');
    },
  });

  return {
    requests,
    balance,
    isLoading,
    createRequest: createRequest.mutate,
    updateStatus: updateStatus.mutate,
  };
};
