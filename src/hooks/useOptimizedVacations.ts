import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export const useOptimizedVacations = (userId: string | undefined, isAdmin: boolean) => {
  const queryClient = useQueryClient();

  // Optimized query - simplificat fără JOIN complex
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['vacation-requests', userId, isAdmin],
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
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
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
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
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
      status: 'approved' | 'rejected';
      adminNotes?: string;
      reviewedBy: string;
    }) => {
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
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast.success(
        variables.status === 'approved' ? 'Cerere aprobată' : 'Cerere respinsă'
      );
    },
    onError: (error: any) => {
      console.error('Error updating status:', error);
      toast.error('Eroare la actualizarea cererii');
    },
  });

  return {
    requests,
    isLoading,
    createRequest: createRequest.mutate,
    updateStatus: updateStatus.mutate,
  };
};
