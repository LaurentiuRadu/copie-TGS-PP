import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface TimeEntryData {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  created_at: string;
}

interface TeamMemberEntry {
  user_id: string;
  full_name: string;
  username: string;
  entries: Record<number, TimeEntryData[]>; // day_of_week -> entries
}

interface TeamLeaderInfo {
  user_id: string;
  full_name: string;
  username: string;
}

interface CoordinatorInfo {
  user_id: string;
  full_name: string;
  username: string;
}

export const useTeamTimeEntries = (teamId: string | null, weekStartDate: string) => {
  return useQuery({
    queryKey: ['team-time-entries', teamId, weekStartDate],
    queryFn: async () => {
      if (!teamId) return null;

      // 1. Obține membrii echipei programați în săptămâna selectată
      const { data: schedules, error: schedulesError } = await supabase
        .from('weekly_schedules')
        .select('user_id, team_leader_id, coordinator_id')
        .eq('team_id', teamId)
        .eq('week_start_date', weekStartDate);

      if (schedulesError) throw schedulesError;
      if (!schedules || schedules.length === 0) return null;

      // Colectăm TOȚI membrii echipei: membri + șefi + coordonatori
      const allIds = new Set<string>();
      
      schedules.forEach((s: any) => {
        if (s.user_id) allIds.add(s.user_id);
        if (s.team_leader_id) allIds.add(s.team_leader_id);
        if (s.coordinator_id) allIds.add(s.coordinator_id);
      });

      const scheduledUserIds = Array.from(allIds);

      // 2. Obține profilurile pentru toți membrii
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', scheduledUserIds);

      if (profilesError) throw profilesError;

      // 3. Obține pontajele pentru toți membrii din săptămâna selectată
      const weekStart = new Date(weekStartDate);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const { data: timeEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in_time, clock_out_time, created_at')
        .in('user_id', scheduledUserIds)
        .gte('clock_in_time', weekStart.toISOString())
        .lte('clock_in_time', weekEnd.toISOString())
        .order('clock_in_time');

      if (entriesError) throw entriesError;

      // 4. Identifică membrii cu pontaje dar fără schedule
      const timeEntryUserIds = [...new Set(timeEntries?.map((e: any) => e.user_id) || [])];
      const missingUserIds = timeEntryUserIds.filter(id => !scheduledUserIds.includes(id));

      // 5. Obține profilurile pentru membrii fără schedule
      let missingProfiles: any[] = [];
      if (missingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', missingUserIds);
        missingProfiles = profiles || [];
      }

      // 6. Identifică șeful de echipă și coordonatorul
      let teamLeader: TeamLeaderInfo | null = null;
      let coordinator: CoordinatorInfo | null = null;

      // Obținem primul schedule pentru a identifica șeful și coordonatorul
      const firstSchedule = schedules[0];
      if (firstSchedule?.team_leader_id) {
        const leaderProfile = profiles?.find((p: any) => p.id === firstSchedule.team_leader_id);
        if (leaderProfile) {
          teamLeader = {
            user_id: leaderProfile.id,
            full_name: leaderProfile.full_name || 'Necunoscut',
            username: leaderProfile.username || ''
          };
        }
      }

      if (firstSchedule?.coordinator_id) {
        const coordinatorProfile = profiles?.find((p: any) => p.id === firstSchedule.coordinator_id);
        if (coordinatorProfile) {
          coordinator = {
            user_id: coordinatorProfile.id,
            full_name: coordinatorProfile.full_name || 'Necunoscut',
            username: coordinatorProfile.username || ''
          };
        }
      }

      // 7. Grupează pontajele pe user și zi
      const memberData: Record<string, TeamMemberEntry> = {};

      // Construim memberData din toate profilurile colectate
      profiles?.forEach((profile: any) => {
        memberData[profile.id] = {
          user_id: profile.id,
          full_name: profile.full_name || 'Necunoscut',
          username: profile.username || '',
          entries: {}
        };
      });

      // Adaugă membrii cu pontaje dar fără schedule
      missingProfiles.forEach((profile: any) => {
        if (!memberData[profile.id]) {
          memberData[profile.id] = {
            user_id: profile.id,
            full_name: profile.full_name || 'Necunoscut',
            username: profile.username || '',
            entries: {}
          };
        }
      });

      // Adaugă pontajele
      timeEntries?.forEach((entry: any) => {
        const userId = entry.user_id;
        if (memberData[userId]) {
          const entryDate = new Date(entry.clock_in_time);
          // Calculăm ziua relativă la week_start_date (1-7 pentru Luni-Duminică)
          const daysDiff = Math.floor((entryDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
          const dayOfWeek = daysDiff + 1; // 1=Luni, 7=Duminică

          if (!memberData[userId].entries[dayOfWeek]) {
            memberData[userId].entries[dayOfWeek] = [];
          }
          memberData[userId].entries[dayOfWeek].push(entry);
        }
      });

      return {
        teamId,
        weekStartDate,
        members: Object.values(memberData),
        teamLeader,
        coordinator
      };
    },
    enabled: !!teamId && !!weekStartDate,
    staleTime: 0 // Always refetch to ensure fresh data
  });
};
