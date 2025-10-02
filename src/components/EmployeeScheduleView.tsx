import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { ro } from 'date-fns/locale';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export function EmployeeScheduleView() {
  const { user } = useAuth();
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['my-schedules', user?.id, currentWeekStart],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', currentWeekStart)
        .order('day_of_week');

      if (error) throw error;
      return data;
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
                <span className="text-sm text-muted-foreground">Echipa {schedule.team_id}</span>
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
