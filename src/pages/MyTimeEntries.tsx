import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModernCalendar } from '@/components/ui/modern-calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { EmployeeLayout } from '@/components/layouts/EmployeeLayout';

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  time_entry_segments: Array<{
    segment_type: string;
    hours_decimal: number;
    multiplier: number;
  }>;
}

const MyTimeEntries = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          time_entry_segments(*)
        `)
        .eq('user_id', user.id)
        .gte('clock_in_time', start.toISOString())
        .lte('clock_in_time', end.toISOString())
        .order('clock_in_time', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error('Error fetching entries:', error);
      toast.error('Eroare la încărcarea pontajelor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedMonth, user]);

  const getSegmentLabel = (type: string) => {
    const labels: Record<string, string> = {
      normal_day: 'Ore Zi',
      normal_night: 'Ore Noapte +25%',
      weekend_saturday_day: 'Sâmbătă +50%',
      weekend_saturday_night: 'Sâmbătă Noapte +50%',
      weekend_sunday_day: 'Duminică +100%',
      weekend_sunday_night: 'Duminică Noapte +100%',
      holiday_day: 'Sărbătoare +100%',
      holiday_night: 'Sărbătoare Noapte +100%',
    };
    return labels[type] || type;
  };

  const calculateTotalHours = (entry: TimeEntry) => {
    if (!entry.time_entry_segments || entry.time_entry_segments.length === 0) {
      if (!entry.clock_out_time) return 0;
      const duration = new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime();
      return duration / (1000 * 60 * 60);
    }
    
    return entry.time_entry_segments.reduce((sum, seg) => sum + seg.hours_decimal, 0);
  };

  const calculateWeightedHours = (entry: TimeEntry) => {
    if (!entry.time_entry_segments || entry.time_entry_segments.length === 0) {
      return calculateTotalHours(entry);
    }
    
    return entry.time_entry_segments.reduce(
      (sum, seg) => sum + (seg.hours_decimal * seg.multiplier), 
      0
    );
  };

  const monthlyTotalHours = entries.reduce((sum, entry) => sum + calculateTotalHours(entry), 0);
  const monthlyWeightedHours = entries.reduce((sum, entry) => sum + calculateWeightedHours(entry), 0);

  return (
    <EmployeeLayout title="Pontajele Mele">
      <div className="container mx-auto p-4 md:p-6 space-y-6 bg-mesh min-h-screen">
        {/* Monthly Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card elevated-card animate-fade-in hover:scale-105 transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Ore Lucrate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-foreground">{monthlyTotalHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(selectedMonth, 'MMMM yyyy', { locale: ro })}
            </p>
          </CardContent>
          </Card>

          <Card className="glass-card elevated-card animate-fade-in hover:scale-105 transition-all duration-300" style={{ animationDelay: '100ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Ore Plătite (cu sporuri)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-primary glow-primary">{monthlyWeightedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">Echivalent total</p>
          </CardContent>
          </Card>

          <Card className="glass-card elevated-card animate-fade-in hover:scale-105 transition-all duration-300" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Bonus Sporuri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-success glow-accent">
              +{(monthlyWeightedHours - monthlyTotalHours).toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ore bonus</p>
          </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Calendar */}
          <Card className="glass-card border-primary/20 animate-scale-in">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-semibold">Selectează Luna</CardTitle>
          </CardHeader>
          <CardContent>
            <ModernCalendar
              mode="single"
              selected={selectedMonth}
              onSelect={(date) => date && setSelectedMonth(date)}
              locale={ro}
              className="rounded-md border border-primary/10 glass-card"
            />
          </CardContent>
          </Card>

          {/* Entries List */}
          <Card className="glass-card lg:col-span-2 animate-scale-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-semibold">Detalii Pontaje ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="glass-card p-8 text-center animate-shimmer">
                <div className="text-muted-foreground">Se încarcă...</div>
              </div>
            ) : entries.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <div className="text-muted-foreground">
                  Nu există pontaje pentru această lună
                </div>
              </div>
            ) : (
              entries.map((entry, entryIndex) => {
                const totalHours = calculateTotalHours(entry);
                const weightedHours = calculateWeightedHours(entry);
                const hasSegments = entry.time_entry_segments?.length > 0;

                return (
                  <Card 
                    key={entry.id} 
                    className="glass-card hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-95 animate-slide-up-fade"
                    style={{ animationDelay: `${entryIndex * 50}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-sm md:text-base">
                              {format(new Date(entry.clock_in_time), 'dd MMM yyyy', { locale: ro })}
                            </span>
                          </div>
                          {!entry.clock_out_time && (
                            <Badge variant="success" className="animate-glow-pulse">În desfășurare</Badge>
                          )}
                        </div>

                        {/* Time Range */}
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(entry.clock_in_time), 'HH:mm')}
                          {entry.clock_out_time && ` - ${format(new Date(entry.clock_out_time), 'HH:mm')}`}
                        </div>

                        {/* Segments Breakdown */}
                        {hasSegments && (
                          <div className="space-y-2 animate-slide-up-fade">
                            <div className="text-sm font-medium flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" />
                              Breakdown ore:
                            </div>
                            {entry.time_entry_segments.map((seg, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm pl-6">
                                <span className="text-muted-foreground">{getSegmentLabel(seg.segment_type)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{seg.hours_decimal.toFixed(2)}h</span>
                                  {seg.multiplier > 1 && (
                                    <Badge variant="info" className="text-xs">
                                      ×{seg.multiplier}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-primary/20 flex justify-between font-semibold">
                              <span>Total plătit:</span>
                              <span className="text-primary glow-primary">{weightedHours.toFixed(2)}h</span>
                            </div>
                          </div>
                        )}

                        {!hasSegments && entry.clock_out_time && (
                          <div className="text-sm text-muted-foreground">
                            Total: {totalHours.toFixed(2)}h (fără segmentare)
                          </div>
                        )}
                      </div>
                     </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
};

export default MyTimeEntries;