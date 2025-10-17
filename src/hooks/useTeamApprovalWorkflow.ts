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
  original_clock_in_time?: string;
  original_clock_out_time?: string;
  was_edited_by_admin?: boolean;
  approval_notes?: string;
  approved_at?: string;
  approved_by?: string;
  pontajNumber?: number;
  isMissing?: boolean; // ← NOU: flag pentru angajați lipsă
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
  calculated_hours?: {
    total: number;
  };
  segments?: Array<{
    id: string;
    segment_type: string;
    start_time: string;
    end_time: string;
    hours_decimal: number;
  }>;
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
  teamMembers: { id: string; full_name: string; username: string }[];
}

export const useTeamApprovalWorkflow = (
  teamId: string | null, 
  weekStartDate: string,
  selectedDayOfWeek: number
) => {
  const queryClient = useQueryClient();

  // 1. Fetch pending time entries pentru echipă și săptămână (exclude contractori + personal birou)
  const { data, isLoading } = useQuery<TeamApprovalData>({
    queryKey: ['team-pending-approvals', teamId, weekStartDate, selectedDayOfWeek],
    queryFn: async (): Promise<TeamApprovalData> => {
      if (!teamId || !weekStartDate) return { entries: [], teamLeader: null, coordinator: null, teamMembers: [] };

      const weekStart = new Date(weekStartDate);
      const weekEnd = addDays(weekStart, 7);

      // Get user IDs and schedules data - exclude contractori și personal birou
      const { data: schedules, error: schedError } = await supabase
        .from('weekly_schedules')
        .select(`
          user_id, 
          team_leader_id, 
          coordinator_id, 
          day_of_week, 
          shift_type, 
          location, 
          activity, 
          vehicle, 
          observations,
          profiles!inner(id, full_name, username, is_external_contractor, is_office_staff)
        `)
        .eq('team_id', teamId)
        .eq('week_start_date', weekStartDate)
        .eq('day_of_week', selectedDayOfWeek)
        .eq('profiles.is_external_contractor', false)
        .eq('profiles.is_office_staff', false);

      if (schedError) throw schedError;
      const userIds = schedules?.map(s => s.user_id) || [];

      // ✅ Debugging: log schedules found
      console.log('[Team Approval] Schedules found:', schedules?.length, 'for team:', teamId, 'week:', weekStartDate);

      if (userIds.length === 0) {
        console.warn('[Team Approval] ⚠️ No schedules found for this team/week');
        return { entries: [], teamLeader: null, coordinator: null, teamMembers: [] };
      }

      // Extract team leader and coordinator IDs
      const teamLeaderIds = schedules
        ?.map(s => s.team_leader_id)
        .filter((id): id is string => id !== null) || [];
      const coordinatorIds = schedules
        ?.map(s => s.coordinator_id)
        .filter((id): id is string => id !== null) || [];

      // Combine all IDs for profile fetch
      const allUserIds = [...new Set([...userIds, ...teamLeaderIds, ...coordinatorIds])];

      if (userIds.length === 0) return { entries: [], teamLeader: null, coordinator: null, teamMembers: [] };

      // Calculăm data exactă pentru ziua selectată
      const targetDate = addDays(weekStart, selectedDayOfWeek - 1);
      const nextDay = addDays(targetDate, 1);

      // Fetch time entries pentru ziua selectată
      const { data: entriesData, error } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in_time, clock_out_time, approval_status, original_clock_in_time, original_clock_out_time, was_edited_by_admin, approval_notes, approved_at, approved_by')
        .in('user_id', allUserIds)
        .gte('clock_in_time', targetDate.toISOString())
        .lt('clock_in_time', nextDay.toISOString())
        .in('approval_status', ['pending_review', 'approved'])
        .order('approval_status', { ascending: false })
        .order('clock_in_time', { ascending: true });

      if (error) throw error;

      // Fetch time entry segments pentru vizualizare detaliată
      const entryIds = entriesData?.map(e => e.id) || [];
      const { data: segmentsData } = await supabase
        .from('time_entry_segments')
        .select('id, time_entry_id, segment_type, start_time, end_time, hours_decimal')
        .in('time_entry_id', entryIds)
        .order('start_time', { ascending: true });

      // Grupăm segmentele pe time_entry_id
      const segmentsByEntry = new Map<string, Array<typeof segmentsData[0]>>();
      segmentsData?.forEach(segment => {
        if (!segmentsByEntry.has(segment.time_entry_id)) {
          segmentsByEntry.set(segment.time_entry_id, []);
        }
        segmentsByEntry.get(segment.time_entry_id)!.push(segment);
      });

      // Fetch profiles separately (exclude contractors + office staff)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, username, is_external_contractor, is_office_staff')
        .in('id', allUserIds)
        .eq('is_external_contractor', false)
        .eq('is_office_staff', false);


      // Track pontaj numbers per user for multiple entries per day
      const pontajCountByUser = new Map<string, number>();

      // ✅ DEDUPE PROTECTION: Group entries by user+time to avoid displaying duplicates
      const seenEntries = new Map<string, string>(); // key: user_id + clock_in + clock_out, value: entry_id
      const uniqueEntriesData = entriesData?.filter(entry => {
        if (!entry.clock_out_time) return true; // Keep incomplete entries
        
        const key = `${entry.user_id}_${entry.clock_in_time}_${entry.clock_out_time}`;
        if (seenEntries.has(key)) {
          console.warn(`[Dedupe Protection] Skipping duplicate entry ${entry.id} for user ${entry.user_id}`);
          return false;
        }
        seenEntries.set(key, entry.id);
        return true;
      }) || [];

      // ✅ DETECTARE ANGAJAȚI LIPSĂ (programați dar fără pontaj)
      const scheduledUserIds = schedules?.map(s => s.user_id) || [];
      const entriesUserIds = new Set(uniqueEntriesData.map(e => e.user_id));
      const missingUserIds = scheduledUserIds.filter(id => !entriesUserIds.has(id));

      console.log(`[Missing Detection] Programați: ${scheduledUserIds.length}, Cu pontaje: ${entriesUserIds.size}, Lipsă: ${missingUserIds.length}`);

      // Creează entries "virtuale" pentru angajați lipsă
      const virtualEntries = missingUserIds.map(userId => {
        const schedule = schedules?.find(s => s.user_id === userId);
        const profile = profilesData?.find(p => p.id === userId);
        
        return {
          id: `virtual-${userId}-${selectedDayOfWeek}`,
          user_id: userId,
          clock_in_time: null as any,
          clock_out_time: null,
          approval_status: 'missing',
          isMissing: true,
          profiles: profile || { id: userId, full_name: 'Unknown', username: 'unknown' },
          scheduled_shift: schedule?.shift_type,
          scheduled_location: schedule?.location,
          scheduled_activity: schedule?.activity,
          scheduled_vehicle: schedule?.vehicle,
          scheduled_observations: schedule?.observations,
          day_of_week: selectedDayOfWeek,
          segments: [],
          calculated_hours: { total: 0 },
          pontajNumber: 0,
        };
      });

      // Merge profiles with entries and match with schedules
      const result = uniqueEntriesData.map(entry => {
        // ✅ FIX: Convert UTC to Romania time (+3 hours) before getting day_of_week
        const clockInDate = new Date(entry.clock_in_time);
        const romaniaTime = new Date(clockInDate.getTime() + 3 * 60 * 60 * 1000);
        
        // Convert to day_of_week (Luni=1, Duminică=7)
        const dayOfWeek = romaniaTime.getDay() === 0 ? 7 : romaniaTime.getDay();
        
        console.log(`[Matching] Entry ${entry.id.slice(0, 8)}: clock_in=${clockInDate.toISOString()}, romaniaTime=${romaniaTime.toISOString()}, dayOfWeek=${dayOfWeek}`);
        
        // ✅ Calculate pontaj number for this user
        const currentCount = (pontajCountByUser.get(entry.user_id) || 0) + 1;
        pontajCountByUser.set(entry.user_id, currentCount);
        
        // Find matching schedule for this user and day
        const matchingSchedule = schedules?.find(
          s => s.user_id === entry.user_id && s.day_of_week === dayOfWeek
        );

        if (!matchingSchedule) {
          console.warn(`[Matching] ⚠️ No schedule found for user ${entry.user_id} on day ${dayOfWeek}, trying fallback...`);
        }

        // Fallback: try to find any schedule for this user
        const fallbackSchedule = !matchingSchedule ? schedules?.find(s => s.user_id === entry.user_id) : null;
        if (fallbackSchedule && !matchingSchedule) {
          console.log(`[Matching] 📌 Using fallback schedule for user ${entry.user_id}`);
        }

        const activeSchedule = matchingSchedule || fallbackSchedule;

        // Calculate total hours (simple clock_out - clock_in)
        const calculated_hours = entry.clock_out_time ? {
          total: (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60)
        } : { total: 0 };

        return {
          ...entry,
          pontajNumber: currentCount,
          segments: segmentsByEntry.get(entry.id) || [],
          profiles: profilesData?.find(p => p.id === entry.user_id) || {
            id: entry.user_id,
            full_name: 'Unknown',
            username: 'unknown'
          },
          scheduled_shift: activeSchedule?.shift_type,
          scheduled_location: activeSchedule?.location,
          scheduled_activity: activeSchedule?.activity,
          scheduled_vehicle: activeSchedule?.vehicle,
          scheduled_observations: activeSchedule?.observations,
          day_of_week: dayOfWeek,
          calculated_hours,
        };
      });

      // Extract team leader and coordinator profiles
      const teamLeader = profilesData?.find(p => teamLeaderIds.includes(p.id)) || null;
      const coordinator = profilesData?.find(p => coordinatorIds.includes(p.id)) || null;

      // Extract unique team members (exclude team leader and coordinator)
      const memberIds = [...new Set(schedules?.map(s => s.user_id) || [])];
      const teamMembersData = memberIds
        .map(memberId => profilesData?.find(p => p.id === memberId))
        .filter((p): p is NonNullable<typeof p> => 
          p !== null && 
          p.id !== teamLeader?.id && 
          p.id !== coordinator?.id
        );

      // Sort alphabetically by full_name
      teamMembersData.sort((a, b) => a.full_name.localeCompare(b.full_name));

      // Combină entries reale cu virtuale
      const allEntries = [...result, ...virtualEntries];

      return { 
        entries: allEntries as TimeEntryForApproval[], 
        teamLeader, 
        coordinator,
        teamMembers: teamMembersData
      };
    },
    enabled: !!teamId && !!weekStartDate && !!selectedDayOfWeek,
    staleTime: 30000, // 30 sec cache pentru performanță
    gcTime: 5 * 60 * 1000, // 5 min în memory
  });

  const pendingEntries = data?.entries || [];
  const teamLeader = data?.teamLeader || null;
  const coordinator = data?.coordinator || null;
  const teamMembers = data?.teamMembers || [];

  // 2. Calculate team statistics (only for pending entries)
  const pendingOnlyEntries = pendingEntries.filter(e => e.approval_status === 'pending_review');
  
  const teamStats: TeamStats = {
    avgClockIn: null,
    avgClockOut: null,
    totalEntries: pendingEntries.length,
    pendingCount: pendingOnlyEntries.length,
  };

  if (pendingOnlyEntries.length > 0) {
    const clockIns = pendingOnlyEntries
      .map(e => e.clock_in_time ? new Date(e.clock_in_time).getHours() * 60 + new Date(e.clock_in_time).getMinutes() : null)
      .filter((t): t is number => t !== null);

    const clockOuts = pendingOnlyEntries
      .map(e => e.clock_out_time ? new Date(e.clock_out_time).getHours() * 60 + new Date(e.clock_out_time).getMinutes() : null)
      .filter((t): t is number => t !== null);

    if (clockIns.length > 0) {
      const avgMinutes = Math.round(clockIns.reduce((a, b) => a + b, 0) / clockIns.length);
      teamStats.avgClockIn = `${Math.floor(avgMinutes / 60).toString().padStart(2, '0')}:${(avgMinutes % 60).toString().padStart(2, '0')}`;
    } else {
      teamStats.avgClockIn = '--:--'; // ✅ FIX: Fallback pentru NaN
    }

    if (clockOuts.length > 0) {
      const avgMinutes = Math.round(clockOuts.reduce((a, b) => a + b, 0) / clockOuts.length);
      teamStats.avgClockOut = `${Math.floor(avgMinutes / 60).toString().padStart(2, '0')}:${(avgMinutes % 60).toString().padStart(2, '0')}`;
    } else {
      teamStats.avgClockOut = '--:--'; // ✅ FIX: Fallback pentru NaN
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
        severity: diff > 120 ? 'critical' : (diff > 60 ? 'high' : 'medium'), // ✅ ADDED critical level for >2h
        expected_value: teamStats.avgClockIn,
        actual_value: format(entryClockIn, 'HH:mm'),
      };
    }

    return null;
  };

  // 4. Approve single entry
  const approveMutation = useMutation({
    mutationFn: async ({ entryId, notes }: { entryId: string; notes?: string }) => {
      // STEP 1: Fetch entry pentru validare
      const { data: entry, error: fetchError } = await supabase
        .from('time_entries')
        .select('clock_in_time, clock_out_time')
        .eq('id', entryId)
        .single();

      if (fetchError || !entry) throw new Error('Pontaj negăsit');

      // STEP 2: Validare existență clock_out
      if (!entry.clock_out_time) {
        throw new Error('❌ Clock-out lipsește! Nu se poate aproba pontaj incomplet.');
      }

      // STEP 3: Validare durată (10 min - 24 ore) ✅ CORECTAT!
      const clockIn = new Date(entry.clock_in_time);
      const clockOut = new Date(entry.clock_out_time);
      const durationHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      if (durationHours < 0.17) { // ✅ 10 min = 0.167h
        throw new Error(`❌ Durată prea scurtă: ${Math.round(durationHours * 60)} min. Minimum: 10 minute.`);
      }

      if (durationHours > 24) {
        throw new Error(`❌ Durată suspectă: ${durationHours.toFixed(1)}h. Maximum: 24 ore.`);
      }

      // STEP 4: Continue cu aprobarea
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approval_notes: notes,
          needs_reprocessing: false, // ✅ Auto-clear din "Pontaje Suspicioase"
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
      queryClient.invalidateQueries({ queryKey: ['suspicious-entries'] }); // ✅ Auto-refresh în "Pontaje Suspicioase"
      toast({
        title: 'Pontaj aprobat',
        description: 'Pontajul a fost aprobat cu succes',
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Nu s-a putut aproba pontajul';
      toast({
        title: 'Eroare la aprobare',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('[Approval Error]', error);
    },
  });

  // 5. Approve batch (multiple entries)
  const approveBatchMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      // STEP 1: Fetch all entries pentru validare
      const { data: entries, error: fetchError } = await supabase
        .from('time_entries')
        .select('id, clock_in_time, clock_out_time')
        .in('id', entryIds);

      if (fetchError) throw fetchError;

      // STEP 2: Validare fiecare pontaj (10 min - 24 ore) ✅ CORECTAT!
      const validationErrors: string[] = [];
      entries?.forEach(entry => {
        if (!entry.clock_out_time) {
          validationErrors.push(`${entry.id.slice(0, 8)}: lipsește clock-out`);
          return;
        }

        const durationHours = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
        
        if (durationHours < 0.17 || durationHours > 24) { // ✅ 10 min = 0.167h
          validationErrors.push(`${entry.id.slice(0, 8)}: durată ${Math.round(durationHours * 60)} min (invalid)`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(`❌ Validare eșuată:\\n${validationErrors.join('\\n')}`);
      }

      // STEP 3: Update all entries
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approval_notes: 'Aprobare în lot',
          needs_reprocessing: false, // ✅ Auto-clear din "Pontaje Suspicioase"
        })
        .in('id', entryIds);

      if (updateError) throw updateError;

      // Trigger calculate-time-segments for each (parallel)
      const segmentResults = await Promise.allSettled(
        entryIds.map(id =>
          supabase.functions.invoke('calculate-time-segments', {
            body: { time_entry_id: id },
          })
        )
      );

      // ✅ FIX: Log failures pentru diagnoză
      const failures = segmentResults.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('❌ [Batch Approval] Edge function failures:', {
          total: entryIds.length,
          failed: failures.length,
          details: failures.map((f, idx) => ({
            entry_id: entryIds[idx],
            reason: (f as PromiseRejectedResult).reason
          }))
        });
      }

      // ✅ Log successes cu warnings (ex: validation errors)
      const successes = segmentResults.filter(r => r.status === 'fulfilled');
      successes.forEach((result, idx) => {
        const response = (result as PromiseFulfilledResult<any>).value;
        if (response.error) {
          console.warn(`⚠️ Entry ${entryIds[idx]}: ${response.error.message}`, response.error);
        }
        if (response.data?.segments_saved === true && response.data?.timesheet_saved === false) {
          console.warn(`⚠️ Entry ${entryIds[idx]}: Segments salvate DAR timesheet NU (validare eșuată)`);
        }
      });
    },
    onSuccess: async (_, entryIds) => {
      await queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      await queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      await queryClient.invalidateQueries({ queryKey: ['suspicious-entries'] }); // ✅ Auto-refresh în "Pontaje Suspicioase"
      
      // ✅ Force refetch immediate pentru refresh vizual
      await queryClient.refetchQueries({ 
        queryKey: ['team-pending-approvals', teamId, weekStartDate, selectedDayOfWeek] 
      });
      
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

  return {
    pendingEntries,
    teamLeader,
    coordinator,
    teamMembers,
    teamStats,
    isLoading,
    detectDiscrepancies,
    approveMutation,
    approveBatchMutation,
  };
};
