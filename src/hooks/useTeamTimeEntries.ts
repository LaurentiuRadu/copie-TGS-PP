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

export const useTeamTimeEntries = (teamId: string | null, weekStartDate: string) => {
  return useQuery({
    queryKey: ['team-time-entries', teamId, weekStartDate],
    queryFn: async () => {
      if (!teamId) return null;

      // 1. Obține membrii echipei din săptămâna selectată
      const { data: schedules, error: schedulesError } = await supabase
        .from('weekly_schedules')
        .select('user_id, day_of_week, profiles(id, full_name, username)')
        .eq('team_id', teamId)
        .eq('week_start_date', weekStartDate);

      if (schedulesError) throw schedulesError;
      if (!schedules || schedules.length === 0) return null;

      // Obține user_id-uri unice din schedules
      const scheduledUserIds = [...new Set(schedules.map((s: any) => s.user_id))];

      // 2. Obține pontajele pentru toți membrii din săptămâna selectată
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

      // 3. Identifică membrii cu pontaje dar fără schedule
      const timeEntryUserIds = [...new Set(timeEntries?.map((e: any) => e.user_id) || [])];
      const missingUserIds = timeEntryUserIds.filter(id => !scheduledUserIds.includes(id));

      // 4. Obține profilurile pentru membrii fără schedule
      let missingProfiles: any[] = [];
      if (missingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', missingUserIds);
        missingProfiles = profiles || [];
      }

      // 5. Grupează pontajele pe user și zi
      const memberData: Record<string, TeamMemberEntry> = {};

      // Adaugă toți membrii programați
      schedules.forEach((schedule: any) => {
        const userId = schedule.user_id;
        if (!memberData[userId]) {
          memberData[userId] = {
            user_id: userId,
            full_name: schedule.profiles?.full_name || 'Necunoscut',
            username: schedule.profiles?.username || '',
            entries: {}
          };
        }
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

      // Deduplicare explicită pentru a preveni duplicate
      const uniqueMembers = Object.values(memberData).filter((member, index, self) => 
        self.findIndex(m => m.user_id === member.user_id) === index
      );

      return {
        teamId,
        weekStartDate,
        members: uniqueMembers
      };
    },
    enabled: !!teamId && !!weekStartDate,
    staleTime: 30000 // 30 seconds
  });
};
