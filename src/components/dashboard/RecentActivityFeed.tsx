import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

export const RecentActivityFeed = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('id, clock_in_time, clock_out_time, user_id')
        .order('clock_in_time', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(entries?.map(e => e.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, { full_name: p.full_name }]) || []);

      // Merge profiles with entries
      return entries?.map(entry => ({
        ...entry,
        profiles: profileMap.get(entry.user_id) || { full_name: 'Unknown' }
      }));
    },
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activitate Recentă
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {data?.map((entry) => {
              const hasClockOut = !!entry.clock_out_time;
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className={`p-2 rounded-full ${hasClockOut ? 'bg-success/20' : 'bg-primary/20'}`}>
                    {hasClockOut ? (
                      <LogOut className="h-4 w-4 text-success" />
                    ) : (
                      <LogIn className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(entry as any).profiles?.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hasClockOut ? 'Clock Out' : 'Clock In'} •{' '}
                      {formatDistanceToNow(
                        new Date(hasClockOut ? entry.clock_out_time! : entry.clock_in_time),
                        { addSuffix: true, locale: ro }
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
