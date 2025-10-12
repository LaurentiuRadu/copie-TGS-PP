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

      const request = requests.find(r => r.id === id);

      // If withdrawn, remove from daily_timesheets
      if (status === 'withdrawn' && request) {
        // SAFETY CHECK: Cererea trebuie să fie 'approved' pentru a o retrage
        if (request.status !== 'approved') {
          throw new Error(`Această cerere nu poate fi retrasă (status actual: ${request.status})`);
        }

        if (request.type === 'vacation') {
          console.log(`[Vacation Withdrawal] 🔄 Withdrawing CO request: ${id}`);
          
          try {
            const { data, error: withdrawError } = await supabase.functions.invoke('withdraw-approved-vacation', {
              body: {
                request_id: id,
                reason: adminNotes || 'Retras de utilizator'
              }
            });

            if (withdrawError) {
              console.error('[Vacation Withdrawal] ❌ Edge function error:', withdrawError);
              throw new Error(`Eroare la retragere CO: ${withdrawError.message}`);
            }

            if (data?.success === false || data?.days_failed > 0) {
              console.error('[Vacation Withdrawal] ⚠️ Partial failure:', data);
              throw new Error(`Retragere CO parțială: ${data.days_removed}/${data.total_days} zile eliminate. ${data.days_failed} eșuate.`);
            }

            console.log(`[Vacation Withdrawal] ✅ Successfully withdrawn ${data.days_removed} days`);
            return { request, withdrawResult: data };
          } catch (error: any) {
            console.error('[Vacation Withdrawal] ❌ Withdrawal failed:', error);
            throw error;
          }
        }
        
        if (request.type === 'sick') {
          console.log(`[Medical Withdrawal] 🔄 Withdrawing CM request: ${id}`);
          
          try {
            const { data, error: withdrawError } = await supabase.functions.invoke('withdraw-approved-medical-leave', {
              body: {
                request_id: id,
                reason: adminNotes || 'Retras de utilizator'
              }
            });

            if (withdrawError) {
              console.error('[Medical Withdrawal] ❌ Edge function error:', withdrawError);
              throw new Error(`Eroare la retragere CM: ${withdrawError.message}`);
            }

            if (data?.success === false || data?.days_failed > 0) {
              console.error('[Medical Withdrawal] ⚠️ Partial failure:', data);
              throw new Error(`Retragere CM parțială: ${data.days_removed}/${data.total_days} zile eliminate. ${data.days_failed} eșuate.`);
            }

            console.log(`[Medical Withdrawal] ✅ Successfully withdrawn ${data.days_removed} days`);
            return { request, withdrawResult: data };
          } catch (error: any) {
            console.error('[Medical Withdrawal] ❌ Withdrawal failed:', error);
            throw error;
          }
        }
      }

      // If approved, auto-write to daily_timesheets
      if (status === 'approved' && request) {
        if (request.type === 'vacation') {
          console.log(`[Vacation Approval] ✅ CO Request approved: ${id}`);
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
              throw new Error(`Cerere CO aprobată, dar eroare la procesare: ${processError.message}`);
            }

            if (data?.success === false || data?.days_failed > 0) {
              console.error('[Vacation Approval] ⚠️ Partial failure:', data);
              throw new Error(`Procesare CO parțială: ${data.days_processed}/${data.total_days} zile adăugate. ${data.days_failed} eșuate.`);
            }

            console.log(`[Vacation Approval] ✅ Successfully processed ${data.days_processed} days`);
            return { request, processResult: data };
          } catch (error: any) {
            console.error('[Vacation Approval] ❌ Processing failed:', error);
            throw error;
          }
        } else if (request.type === 'sick') {
          console.log(`[Medical Approval] ✅ CM Request approved: ${id}`);
          console.log(`[Medical Approval] 🔄 Processing ${request.days_count} days to timesheet...`);
          
          try {
            const { data, error: processError } = await supabase.functions.invoke('process-approved-medical-leave', {
              body: {
                request_id: id,
                user_id: request.user_id,
                start_date: request.start_date,
                end_date: request.end_date,
              }
            });

            if (processError) {
              console.error('[Medical Approval] ❌ Edge function error:', processError);
              throw new Error(`Cerere CM aprobată, dar eroare la procesare: ${processError.message}`);
            }

            if (data?.success === false || data?.days_failed > 0) {
              console.error('[Medical Approval] ⚠️ Partial failure:', data);
              throw new Error(`Procesare CM parțială: ${data.days_processed}/${data.total_days} zile adăugate. ${data.days_failed} eșuate.`);
            }

            console.log(`[Medical Approval] ✅ Successfully processed ${data.days_processed} days`);
            return { request, processResult: data };
          } catch (error: any) {
            console.error('[Medical Approval] ❌ Processing failed:', error);
            throw error;
          }
        }
      }

      return { request };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationRequests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationBalance() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
      const request = result?.request;
      const processResult = result?.processResult;
      const withdrawResult = result?.withdrawResult;
      
      if (variables.status === 'withdrawn') {
        if (request?.type === 'vacation') {
          if (withdrawResult?.success) {
            toast.success(`✅ Cerere CO retrasă! ${withdrawResult.days_removed} zile eliminate din pontaj`);
          } else if (withdrawResult?.days_removed > 0) {
            toast.success(`⚠️ Retragere CO parțială: ${withdrawResult.days_removed}/${withdrawResult.total_days} zile eliminate`);
          }
        } else if (request?.type === 'sick') {
          if (withdrawResult?.success) {
            toast.success(`✅ Cerere CM retrasă! ${withdrawResult.days_removed} zile eliminate din pontaj`);
          } else if (withdrawResult?.days_removed > 0) {
            toast.success(`⚠️ Retragere CM parțială: ${withdrawResult.days_removed}/${withdrawResult.total_days} zile eliminate`);
          }
        } else {
          toast.success('✅ Cerere retrasă');
        }
      } else if (variables.status === 'approved') {
        if (request?.type === 'vacation') {
          if (processResult?.success) {
            toast.success(`✅ Cerere CO aprobată! ${processResult.days_processed} zile (8h/zi) adăugate în pontaj`);
          } else if (processResult?.days_processed > 0) {
            toast.success(`⚠️ Cerere CO aprobată parțial: ${processResult.days_processed}/${processResult.total_days} zile procesate`);
          }
        } else if (request?.type === 'sick') {
          if (processResult?.success) {
            toast.success(`✅ Cerere CM aprobată! ${processResult.days_processed} zile (8h/zi) adăugate în pontaj`);
          } else if (processResult?.days_processed > 0) {
            toast.success(`⚠️ Cerere CM aprobată parțial: ${processResult.days_processed}/${processResult.total_days} zile procesate`);
          }
        } else {
          toast.success('✅ Cerere aprobată');
        }
      } else if (variables.status === 'rejected') {
        toast.success('❌ Cerere respinsă');
      }
    },
    onError: (error: any) => {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Eroare la actualizarea cererii');
    },
  });

  // Repair withdrawn request mutation
  const repairWithdrawnRequest = useMutation({
    mutationFn: async (requestId: string) => {
      console.log(`[Repair Vacation] 🔧 Repairing request: ${requestId}`);
      
      const { data, error } = await supabase.functions.invoke('repair-vacation-request', {
        body: { request_id: requestId }
      });

      if (error) {
        console.error('[Repair Vacation] ❌ Error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('[Repair Vacation] ❌ Failed:', data);
        throw new Error(data?.message || 'Reparare eșuată');
      }

      console.log('[Repair Vacation] ✅ Success:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacationRequests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
      if (data.days_removed > 0) {
        toast.success(`✅ Reparare completă: ${data.days_removed} zile șterse din pontaj`);
      } else if (data.days_not_found > 0) {
        toast.info(`ℹ️ Nicio zi de șters - ${data.days_not_found} zile nu erau în pontaj`);
      } else {
        toast.info(`ℹ️ ${data.message || 'Reparare completă'}`);
      }
    },
    onError: (error: any) => {
      console.error('Error repairing request:', error);
      toast.error(error.message || 'Eroare la reparare');
    },
  });

  return {
    requests,
    balance,
    isLoading,
    createRequest: createRequest.mutate,
    updateStatus: updateStatus.mutate,
    repairWithdrawnRequest: repairWithdrawnRequest.mutate,
    isRepairing: repairWithdrawnRequest.isPending,
  };
};
