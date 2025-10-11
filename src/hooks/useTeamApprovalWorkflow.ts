import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { startOfWeek, addDays, format } from 'date-fns';

export interface TimeEntryForApproval {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  approval_status: string;
  profiles: {
    id: string;
    full_name: string;
    username: string;
  };
  scheduled_shift?: string;
  scheduled_location?: string;
  scheduled_activity?: string;
  scheduled_vehicle?: string;
  scheduled_observations?: string;
  day_of_week?: number;
}

interface TeamStats {
  avgClockIn: string | null;
  avgClockOut: string | null;
  totalEntries: number;
  pendingCount: number;
}

interface Discrepancy {
  time_entry_id: string;
  user_id: string;
  discrepancy_type: string;
  severity: string;
  expected_value: string;
  actual_value: string;
}

interface TeamApprovalData {
  entries: TimeEntryForApproval[];
  teamLeader: { id: string; full_name: string; username: string } | null;
  coordinator: { id: string; full_name: string; username: string } | null;
}

export const useTeamApprovalWorkflow = (teamId: string | null, weekStartDate: string) => {
  const queryClient = useQueryClient();

  // 1. Fetch pending time entries pentru echipă și săptămână
  const { data, isLoading } = useQuery<TeamApprovalData>({
    queryKey: ['team-pending-approvals', teamId, weekStartDate],
    queryFn: async (): Promise<TeamApprovalData> => {
      if (!teamId || !weekStartDate) return { entries: [], teamLeader: null, coordinator: null };

      const weekStart = new Date(weekStartDate);
      const weekEnd = addDays(weekStart, 7);

      // Get user IDs and schedules data
      const { data: schedules, error: schedError } = await supabase
        .from('weekly_schedules')
        .select('user_id, team_leader_id, coordinator_id, day_of_week, shift_type, location, activity, vehicle, observations')
        .eq('team_id', teamId)
        .eq('week_start_date', weekStartDate);

      if (schedError) throw schedError;
      const userIds = schedules?.map(s => s.user_id) || [];

      // Extract team leader and coordinator IDs
      const teamLeaderIds = schedules
        ?.map(s => s.team_leader_id)
        .filter((id): id is string => id !== null) || [];
      const coordinatorIds = schedules
        ?.map(s => s.coordinator_id)
        .filter((id): id is string => id !== null) || [];

      // Combine all IDs for profile fetch
      const allUserIds = [...new Set([...userIds, ...teamLeaderIds, ...coordinatorIds])];

      if (userIds.length === 0) return { entries: [], teamLeader: null, coordinator: null };

      // Fetch pending time entries for these users in this week
      const { data: entriesData, error } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in_time, clock_out_time, approval_status')
        .in('user_id', userIds)
        .gte('clock_in_time', weekStart.toISOString())
        .lt('clock_in_time', weekEnd.toISOString())
        .eq('approval_status', 'pending_review')
        .order('clock_in_time', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', allUserIds);

      // Merge profiles with entries and match with schedules
      const result = (entriesData || []).map(entry => {
        const clockInDate = new Date(entry.clock_in_time);
        // Convert to day_of_week (Luni=1, Duminică=7)
        const dayOfWeek = clockInDate.getDay() === 0 ? 7 : clockInDate.getDay();
        
        // Find matching schedule for this user and day
        const matchingSchedule = schedules?.find(
          s => s.user_id === entry.user_id && s.day_of_week === dayOfWeek
        );

        return {
          ...entry,
          profiles: profilesData?.find(p => p.id === entry.user_id) || {
            id: entry.user_id,
            full_name: 'Unknown',
            username: 'unknown'
          },
          scheduled_shift: matchingSchedule?.shift_type,
          scheduled_location: matchingSchedule?.location,
          scheduled_activity: matchingSchedule?.activity,
          scheduled_vehicle: matchingSchedule?.vehicle,
          scheduled_observations: matchingSchedule?.observations,
          day_of_week: dayOfWeek,
        };
      });

      // Extract team leader and coordinator profiles
      const teamLeader = profilesData?.find(p => teamLeaderIds.includes(p.id)) || null;
      const coordinator = profilesData?.find(p => coordinatorIds.includes(p.id)) || null;

      return { 
        entries: result as TimeEntryForApproval[], 
        teamLeader, 
        coordinator 
      };
    },
    enabled: !!teamId && !!weekStartDate,
    staleTime: 30000, // 30 sec cache pentru performanță
    gcTime: 5 * 60 * 1000, // 5 min în memory
  });

  const pendingEntries = data?.entries || [];
  const teamLeader = data?.teamLeader || null;
  const coordinator = data?.coordinator || null;

  // 2. Calculate team statistics
  const teamStats: TeamStats = {
    avgClockIn: null,
    avgClockOut: null,
    totalEntries: pendingEntries.length,
    pendingCount: pendingEntries.length,
  };

  if (pendingEntries.length > 0) {
    const clockIns = pendingEntries
      .map(e => e.clock_in_time ? new Date(e.clock_in_time).getHours() * 60 + new Date(e.clock_in_time).getMinutes() : null)
      .filter((t): t is number => t !== null);

    const clockOuts = pendingEntries
      .map(e => e.clock_out_time ? new Date(e.clock_out_time).getHours() * 60 + new Date(e.clock_out_time).getMinutes() : null)
      .filter((t): t is number => t !== null);

    if (clockIns.length > 0) {
      const avgMinutes = Math.round(clockIns.reduce((a, b) => a + b, 0) / clockIns.length);
      teamStats.avgClockIn = `${Math.floor(avgMinutes / 60).toString().padStart(2, '0')}:${(avgMinutes % 60).toString().padStart(2, '0')}`;
    }

    if (clockOuts.length > 0) {
      const avgMinutes = Math.round(clockOuts.reduce((a, b) => a + b, 0) / clockOuts.length);
      teamStats.avgClockOut = `${Math.floor(avgMinutes / 60).toString().padStart(2, '0')}:${(avgMinutes % 60).toString().padStart(2, '0')}`;
    }
  }

  // 3. Detect discrepancies (>30 min difference from avg)
  const detectDiscrepancies = (entry: TimeEntryForApproval): Discrepancy | null => {
    if (!teamStats.avgClockIn || !entry.clock_in_time) return null;

    const entryClockIn = new Date(entry.clock_in_time);
    const entryMinutes = entryClockIn.getHours() * 60 + entryClockIn.getMinutes();
    
    const [avgHour, avgMin] = teamStats.avgClockIn.split(':').map(Number);
    const avgMinutes = avgHour * 60 + avgMin;

    const diff = Math.abs(entryMinutes - avgMinutes);

    if (diff > 30) {
      return {
        time_entry_id: entry.id,
        user_id: entry.user_id,
        discrepancy_type: entryMinutes > avgMinutes ? 'late_arrival' : 'early_arrival',
        severity: diff > 60 ? 'high' : 'medium',
        expected_value: teamStats.avgClockIn,
        actual_value: format(entryClockIn, 'HH:mm'),
      };
    }

    return null;
  };

  // 4. Approve single entry
  const approveMutation = useMutation({
    mutationFn: async ({ entryId, notes }: { entryId: string; notes?: string }) => {
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approval_notes: notes,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Trigger calculate-time-segments
      const { error: funcError } = await supabase.functions.invoke('calculate-time-segments', {
        body: { time_entry_id: entryId },
      });

      if (funcError) {
        console.warn('[Approval] Calculate segments failed:', funcError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      toast({
        title: 'Pontaj aprobat',
        description: 'Pontajul a fost aprobat cu succes',
      });
    },
    onError: (error) => {
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut aproba pontajul',
        variant: 'destructive',
      });
      console.error('[Approval Error]', error);
    },
  });

  // 5. Approve batch (multiple entries)
  const approveBatchMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      // Update all entries
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approval_notes: 'Aprobare în lot',
        })
        .in('id', entryIds);

      if (updateError) throw updateError;

      // Trigger calculate-time-segments for each (parallel)
      await Promise.allSettled(
        entryIds.map(id =>
          supabase.functions.invoke('calculate-time-segments', {
            body: { time_entry_id: id },
          })
        )
      );
    },
    onSuccess: (_, entryIds) => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      toast({
        title: 'Pontaje aprobate',
        description: `${entryIds.length} pontaje au fost aprobate cu succes`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Eroare',
        description: 'Nu s-au putut aproba toate pontajele',
        variant: 'destructive',
      });
      console.error('[Batch Approval Error]', error);
    },
  });

  // 6. Reject entry
  const rejectMutation = useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason: string }) => {
      const { error } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'rejected',
          approved_at: new Date().toISOString(),
          approval_notes: reason,
        })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast({
        title: 'Pontaj respins',
        description: 'Pontajul a fost respins',
      });
    },
    onError: (error) => {
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut respinge pontajul',
        variant: 'destructive',
      });
      console.error('[Reject Error]', error);
    },
  });

  // 7. Request correction
  const requestCorrectionMutation = useMutation({
    mutationFn: async ({ entryId, notes }: { entryId: string; notes: string }) => {
      const { error } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'needs_correction',
          approval_notes: notes,
        })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast({
        title: 'Corectare solicitată',
        description: 'Pontajul necesită corectare',
      });
    },
    onError: (error) => {
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut solicita corectarea',
        variant: 'destructive',
      });
      console.error('[Request Correction Error]', error);
    },
  });

  return {
    pendingEntries,
    teamLeader,
    coordinator,
    teamStats,
    isLoading,
    detectDiscrepancies,
    approveMutation,
    approveBatchMutation,
    rejectMutation,
    requestCorrectionMutation,
  };
};
