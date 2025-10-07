import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export function ScheduleChangeHistory() {
  const { user } = useAuth();

  const { data: changes, isLoading } = useQuery({
    queryKey: ['schedule-change-history', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('schedule_notifications')
        .select(`
          *,
          weekly_schedules (
            team_id,
            week_start_date,
            day_of_week,
            location,
            activity,
            vehicle,
            observations,
            shift_type,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

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

  if (!changes || changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Istoric Modificări Programare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nu ai modificări recente în ultimele 30 zile</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Istoric Modificări Programare
          <Badge variant="secondary" className="ml-auto">
            Ultimele 30 zile
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {changes.map((change) => {
              const schedule = change.weekly_schedules;
              const isRead = !!change.read_at;
              
              return (
                <div 
                  key={change.id} 
                  className={`border rounded-lg p-4 space-y-2 ${isRead ? 'bg-accent/30' : 'bg-accent/70 border-primary/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold">
                        {dayNames[schedule.day_of_week - 1]}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(schedule.week_start_date), 'dd MMM yyyy', { locale: ro })}
                      </span>
                    </div>
                    <Badge 
                      variant={schedule.shift_type === 'noapte' ? 'secondary' : 'default'}
                      className="text-xs"
                    >
                      {schedule.shift_type === 'zi' ? '☀️ Zi' : '🌙 Noapte'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Echipa:</span>
                    <span className="text-sm font-medium">{schedule.team_id}</span>
                  </div>

                  {schedule.location && (
                    <div className="text-sm">📍 {schedule.location}</div>
                  )}

                  {schedule.activity && (
                    <div className="text-sm">🔧 {schedule.activity}</div>
                  )}

                  {schedule.vehicle && (
                    <div className="text-sm">🚗 {schedule.vehicle}</div>
                  )}

                  <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Notificare: {format(new Date(change.created_at), 'dd MMM, HH:mm', { locale: ro })}
                    </span>
                    {isRead ? (
                      <Badge variant="outline" className="text-xs">
                        ✓ Citită
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        Nouă
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
