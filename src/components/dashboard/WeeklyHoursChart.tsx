import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfWeek, format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

export const WeeklyHoursChart = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['weekly-hours-chart'],
    queryFn: async () => {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      
      const { data, error } = await supabase
        .from('daily_timesheets')
        .select('work_date, hours_regular, hours_night')
        .gte('work_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('work_date', format(addDays(weekStart, 6), 'yyyy-MM-dd'));

      if (error) throw error;

      // Group by day
      const groupedByDay = data.reduce((acc: any, entry) => {
        const day = entry.work_date;
        if (!acc[day]) {
          acc[day] = { date: day, hours: 0 };
        }
        acc[day].hours += (entry.hours_regular || 0) + (entry.hours_night || 0);
        return acc;
      }, {});

      // Fill all 7 days
      const chartData = [];
      for (let i = 0; i < 7; i++) {
        const date = format(addDays(weekStart, i), 'yyyy-MM-dd');
        const dayName = format(addDays(weekStart, i), 'EEE', { locale: ro });
        chartData.push({
          name: dayName,
          hours: groupedByDay[date]?.hours || 0,
        });
      }

      return chartData;
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ore Lucrate Săptămâna Curentă</CardTitle>
        <CardDescription>Total ore pe zi (toate echipele)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar 
              dataKey="hours" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
              name="Ore lucrate"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
