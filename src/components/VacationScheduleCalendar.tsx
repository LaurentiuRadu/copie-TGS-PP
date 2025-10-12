import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { STALE_TIME } from '@/lib/queryConfig';

interface ApprovedVacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  type: string;
  profiles: {
    full_name: string | null;
  } | null;
}

export const VacationScheduleCalendar = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: approvedVacations, isLoading } = useQuery({
    queryKey: ['approved-vacations', isAdmin ? 'all' : user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('vacation_requests')
        .select('*')
        .eq('status', 'approved')
        .order('start_date', { ascending: true });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data: vacations, error } = await query;
      if (error) throw error;

      // Fetch profiles separately if admin
      if (isAdmin && vacations && vacations.length > 0) {
        const userIds = [...new Set(vacations.map(v => v.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return vacations.map(v => ({
          ...v,
          profiles: profileMap.get(v.user_id) || null
        })) as ApprovedVacation[];
      }

      return vacations?.map(v => ({ ...v, profiles: null })) as ApprovedVacation[];
    },
    staleTime: STALE_TIME.ADMIN_DATA,
    enabled: !!user,
  });

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: 'CO',
      sick: 'CM',
      unpaid: 'Fără plată',
      other: 'Altele',
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'sick':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'unpaid':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      default:
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    }
  };

  // Group vacations by month
  const groupedByMonth = approvedVacations?.reduce((acc, vacation) => {
    const monthKey = format(new Date(vacation.start_date), 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(vacation);
    return acc;
  }, {} as Record<string, ApprovedVacation[]>);

  // Get all months in the current year
  const currentYear = new Date().getFullYear();
  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  const yearEnd = endOfYear(new Date(currentYear, 11, 31));
  const allMonths = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Se încarcă...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Programare Concedii Aprobate - {currentYear}
            </CardTitle>
            {isAdmin && (
              <Button variant="outline" size="sm" disabled>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!approvedVacations || approvedVacations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nu există concedii aprobate
            </div>
          ) : (
            allMonths.map((month) => {
              const monthKey = format(month, 'yyyy-MM');
              const vacationsInMonth = groupedByMonth?.[monthKey] || [];

              if (vacationsInMonth.length === 0) return null;

              return (
                <Card key={monthKey} className="bg-accent/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold">
                      {format(month, 'MMMM yyyy', { locale: ro })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {vacationsInMonth.map((vacation) => (
                      <div
                        key={vacation.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border"
                      >
                        <div className="flex-1 space-y-1">
                          {isAdmin && vacation.profiles?.full_name && (
                            <div className="font-semibold text-sm">
                              {vacation.profiles.full_name}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(vacation.start_date), 'dd MMM', { locale: ro })}
                              {' - '}
                              {format(new Date(vacation.end_date), 'dd MMM', { locale: ro })}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {vacation.days_count} {vacation.days_count === 1 ? 'zi' : 'zile'}
                            </Badge>
                          </div>
                        </div>
                        <Badge className={getTypeBadgeColor(vacation.type)}>
                          {getTypeLabel(vacation.type)}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Legendă</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-700 border-green-500/20">CO</Badge>
              <span className="text-muted-foreground">Concediu de odihnă</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20">CM</Badge>
              <span className="text-muted-foreground">Concediu medical</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Fără plată</Badge>
              <span className="text-muted-foreground">Concediu fără plată</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
