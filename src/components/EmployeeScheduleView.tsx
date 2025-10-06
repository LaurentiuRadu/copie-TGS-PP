import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { ro } from 'date-fns/locale';

import { useRealtimeSchedules } from '@/hooks/useRealtimeSchedules';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export function EmployeeScheduleView() {
  const { user } = useAuth();
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  useRealtimeSchedules(true);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['my-schedules', user?.id, currentWeekStart],
    queryFn: async () => {
      if (!user) return [];

      // Get user's schedules
      const { data: mySchedules, error: myError } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', currentWeekStart)
        .order('day_of_week');

      if (myError) throw myError;
      if (!mySchedules || mySchedules.length === 0) return [];

      // Get all team IDs user is part of
      const teamIds = [...new Set(mySchedules.map(s => s.team_id))];

      // Get all schedules for these teams in the same week
      const { data: allTeamSchedules, error: teamError } = await supabase
        .from('weekly_schedules')
        .select('*')
        .in('team_id', teamIds)
        .eq('week_start_date', currentWeekStart)
        .order('day_of_week');

      if (teamError) throw teamError;

      // Get unique user IDs from team schedules
      const userIds = [...new Set(allTeamSchedules?.map(s => s.user_id) || [])];

      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      // Create a map of user_id -> profile
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Attach teammates to each schedule
      const schedulesWithTeammates = mySchedules.map(schedule => {
        const teammates = allTeamSchedules
          ?.filter(ts => 
            ts.team_id === schedule.team_id &&
            ts.day_of_week === schedule.day_of_week &&
            ts.shift_type === schedule.shift_type &&
            ts.location === schedule.location &&
            ts.user_id !== user.id
          )
          .map(ts => {
            const profile = profileMap.get(ts.user_id);
            return {
              id: ts.user_id,
              full_name: profile?.full_name || 'Unknown',
              username: profile?.username || ''
            };
          }) || [];

        return {
          ...schedule,
          teammates
        };
      });

      return schedulesWithTeammates;
    },
    enabled: !!user
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Se încarcă...</p>
        </CardContent>
      </Card>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Programarea Săptămânii
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nu ai programări pentru această săptămână</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Programarea Săptămânii
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div 
              key={schedule.id} 
              className="border rounded-lg p-4 space-y-2 bg-accent/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">{dayNames[schedule.day_of_week - 1]}</span>
                <div className="flex gap-2 items-center">
                  <span className={schedule.shift_type === 'noapte' ? 'text-blue-600 dark:text-blue-400 font-medium text-sm' : 'text-sm'}>
                    {schedule.shift_type === 'zi' ? '☀️ Zi' : '🌙 Noapte'}
                  </span>
                  <span className="text-sm text-muted-foreground">Echipa {schedule.team_id}</span>
                </div>
              </div>
              
              {schedule.location && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-sm">📍</span>
                  <span className="text-sm">{schedule.location}</span>
                </div>
              )}
              
              {schedule.activity && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-sm">🔧</span>
                  <span className="text-sm">{schedule.activity}</span>
                </div>
              )}
              
              {schedule.vehicle && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-sm">🚗</span>
                  <span className="text-sm font-medium">{schedule.vehicle}</span>
                </div>
              )}
              
              {schedule.observations && (
                <div className="flex items-start gap-2 pt-2 border-t">
                  <span className="text-muted-foreground text-sm">💬</span>
                  <span className="text-sm text-muted-foreground">{schedule.observations}</span>
                </div>
              )}
              
              {schedule.teammates && schedule.teammates.length > 0 && (
                <div className="flex items-start gap-2 pt-2 border-t">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Colegii din echipă:</p>
                    <div className="flex flex-wrap gap-1">
                      {schedule.teammates.map((teammate) => (
                        <Badge 
                          key={teammate.id} 
                          variant="secondary" 
                          className="text-xs font-normal"
                        >
                          {teammate.full_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
