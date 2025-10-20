import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Pencil } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export function ApprovalStatsDashboard() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: stats } = useQuery({
    queryKey: ['approval-stats-dashboard'],
    queryFn: async () => {
      // Total pontaje aprobate săptămâna curentă
      const { count: totalApproved } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
        .gte('approved_at', weekStart.toISOString())
        .lte('approved_at', weekEnd.toISOString());

      // Pontaje editate săptămâna curentă
      const { count: totalEdited } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
        .eq('was_edited_by_admin', true)
        .gte('approved_at', weekStart.toISOString())
        .lte('approved_at', weekEnd.toISOString());

      // Top 5 angajați cu cele mai multe editări
      const { data: topEdited } = await supabase
        .from('time_entries')
        .select('user_id')
        .eq('was_edited_by_admin', true)
        .gte('approved_at', weekStart.toISOString())
        .lte('approved_at', weekEnd.toISOString());

      // Fetch profiles separately
      const userIds = [...new Set(topEdited?.map(e => e.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const editCounts = topEdited?.reduce((acc: any, entry: any) => {
        const name = profileMap.get(entry.user_id) || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      const topEditedEmployees = Object.entries(editCounts || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5);

      // Discrepanțe per echipă (simulat - din weekly_schedules)
      const { data: schedules } = await supabase
        .from('weekly_schedules')
        .select('team_id')
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'));

      const teamCounts = schedules?.reduce((acc: any, s: any) => {
        acc[s.team_id] = (acc[s.team_id] || 0) + 1;
        return acc;
      }, {});

      const discrepanciesData = Object.entries(teamCounts || {})
        .map(([team, count]) => ({ team, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      return {
        totalApproved: totalApproved || 0,
        totalEdited: totalEdited || 0,
        editedPercentage: totalApproved ? Math.round((totalEdited / totalApproved) * 100) : 0,
        topEditedEmployees,
        discrepanciesData,
      };
    },
    staleTime: 60000,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pontaje Aprobate</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalApproved}</div>
            <p className="text-xs text-muted-foreground">Săptămâna curentă</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pontaje Editate</CardTitle>
            <Pencil className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEdited}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.editedPercentage}% din total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Procent Editări</CardTitle>
            <Badge variant={stats?.editedPercentage && stats.editedPercentage > 20 ? 'destructive' : 'secondary'}>
              {stats?.editedPercentage || 0}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {stats?.editedPercentage && stats.editedPercentage > 20 
                ? '⚠️ Procent ridicat de editări' 
                : '✅ Procent normal'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Angajați cu Editări</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topEditedEmployees && stats.topEditedEmployees.length > 0 ? (
              <div className="space-y-2">
                {stats.topEditedEmployees.map((emp: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm">{emp.name}</span>
                    <Badge variant="outline">{emp.count} editări</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nicio editare în această săptămână</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pontaje per Echipă</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.discrepanciesData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
