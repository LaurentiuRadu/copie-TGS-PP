import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Clock, Calendar as CalendarIcon, Moon, Sun, Sunset, Gift, Car, Users as PassengerIcon, Wrench, TrendingUp, CalendarDays, ChevronDown, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimeEntryCorrectionDialog } from '@/components/TimeEntryCorrectionDialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AppHeader } from '@/components/AppHeader';
import { useOptimizedMyTimeEntries } from '@/hooks/useOptimizedTimeEntries';
import { useMyDailyTimesheets } from '@/hooks/useDailyTimesheets';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper pentru a extrage tipul de tură din notes
const getShiftTypeFromNotes = (notes: string | null): string => {
  if (!notes) return 'Normal';
  const match = notes.match(/Tip:\s*(Condus|Pasager|Normal|Utilaj)/i);
  return match ? match[1] : 'Normal';
};

const MyTimeEntries = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  
  // Fetch time entries și daily timesheets
  const { data: timeEntries = [], isLoading: entriesLoading } = useOptimizedMyTimeEntries(user?.id, selectedMonth);
  const { data: dailyTimesheets = [], isLoading: timesheetsLoading } = useMyDailyTimesheets(user?.id, selectedMonth);
  
  // Fetch correction requests
  const { data: correctionRequests = [] } = useQuery({
    queryKey: ['correctionRequests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('time_entry_correction_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
  
  const loading = entriesLoading || timesheetsLoading;
  const pendingRequests = correctionRequests.filter(r => r.status === 'pending').length;

  // Calculează totalurile pe tipuri din daily_timesheets
  const monthlyStats = dailyTimesheets.reduce((acc, day) => ({
    total: acc.total + (day.hours_regular || 0) + (day.hours_night || 0) + (day.hours_saturday || 0) + 
           (day.hours_sunday || 0) + (day.hours_holiday || 0) + (day.hours_driving || 0) + 
           (day.hours_passenger || 0) + (day.hours_equipment || 0),
    regular: acc.regular + (day.hours_regular || 0),
    night: acc.night + (day.hours_night || 0),
    saturday: acc.saturday + (day.hours_saturday || 0),
    sunday: acc.sunday + (day.hours_sunday || 0),
    holiday: acc.holiday + (day.hours_holiday || 0),
    driving: acc.driving + (day.hours_driving || 0),
    passenger: acc.passenger + (day.hours_passenger || 0),
    equipment: acc.equipment + (day.hours_equipment || 0),
    days: acc.days + 1,
  }), { total: 0, regular: 0, night: 0, saturday: 0, sunday: 0, holiday: 0, driving: 0, passenger: 0, equipment: 0, days: 0 });

  // Generare luni pentru dropdown
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      options.push({
        value: date.toISOString(),
        label: format(date, 'MMMM yyyy', { locale: ro })
      });
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader userName={user?.user_metadata?.full_name || user?.email} showBackButton />
      
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Month Selector & Correction Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <Select
              value={selectedMonth.toISOString()}
              onValueChange={(value) => setSelectedMonth(new Date(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setCorrectionDialogOpen(true)}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Raportează Problemă Pontaj
              {pendingRequests > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingRequests}</Badge>
              )}
            </Button>
            <div className="text-sm text-muted-foreground hidden sm:block">
              {dailyTimesheets.length} zile lucrate
            </div>
          </div>
        </div>

        {/* Correction Requests Section */}
        {correctionRequests.length > 0 && (
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader>
              <CardTitle className="text-base">Cererile Mele de Corecție</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {correctionRequests.slice(0, 5).map((request) => {
                  const statusConfig = {
                    pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', label: 'În așteptare' },
                    approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', label: 'Aprobată' },
                    rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', label: 'Respinsă' },
                  }[request.status] || { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-300', label: request.status };
                  
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div key={request.id} className={`p-3 rounded-lg ${statusConfig.bg} border ${statusConfig.border}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className={`h-4 w-4 ${statusConfig.color} flex-shrink-0`} />
                            <span className="font-medium text-sm">
                              {format(new Date(request.work_date), 'dd MMM yyyy', { locale: ro })}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {request.description}
                          </p>
                          {request.admin_notes && request.status !== 'pending' && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Admin: {request.admin_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {correctionRequests.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{correctionRequests.length - 5} cereri mai vechi
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Ore */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Total Ore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold text-primary">{monthlyStats.total.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground mt-1">
                {monthlyStats.days} zile lucrate
              </p>
            </CardContent>
          </Card>

          {/* Ore Regulate */}
          {monthlyStats.regular > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  Ore Regulate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{monthlyStats.regular.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Multiplicator 1.0x</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Noapte */}
          {monthlyStats.night > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Moon className="h-4 w-4 text-blue-400" />
                  Ore Noapte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{monthlyStats.night.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Multiplicator 1.25x</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Sâmbătă */}
          {monthlyStats.saturday > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sunset className="h-4 w-4 text-orange-500" />
                  Ore Sâmbătă
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{monthlyStats.saturday.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Multiplicator 1.5x</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Duminică */}
          {monthlyStats.sunday > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-purple-500" />
                  Ore Duminică
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-500">{monthlyStats.sunday.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Multiplicator 2.0x</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Sărbătoare */}
          {monthlyStats.holiday > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Gift className="h-4 w-4 text-red-500" />
                  Ore Sărbătoare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{monthlyStats.holiday.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Multiplicator 2.0x</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Condus */}
          {monthlyStats.driving > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Car className="h-4 w-4 text-green-500" />
                  Ore Condus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{monthlyStats.driving.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Ture speciale</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Pasager */}
          {monthlyStats.passenger > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PassengerIcon className="h-4 w-4 text-cyan-500" />
                  Ore Pasager
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-500">{monthlyStats.passenger.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Ture speciale</p>
              </CardContent>
            </Card>
          )}

          {/* Ore Utilaj */}
          {monthlyStats.equipment > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-slate-500" />
                  Ore Utilaj
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-500">{monthlyStats.equipment.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">Ture speciale</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detailed Time Entries Grouped by Day */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Se încarcă...</div>
              </CardContent>
            </Card>
          ) : timeEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  Nu există pontaje pentru această lună
                </div>
              </CardContent>
            </Card>
          ) : (
            (() => {
              // Grupare pontaje pe zile
              const entriesByDay = timeEntries.reduce((acc, entry) => {
                const dayKey = format(new Date(entry.clock_in_time), 'yyyy-MM-dd');
                if (!acc[dayKey]) {
                  acc[dayKey] = [];
                }
                acc[dayKey].push(entry);
                return acc;
              }, {} as Record<string, typeof timeEntries>);

              // Sortare zile descrescător
              const sortedDays = Object.keys(entriesByDay).sort((a, b) => b.localeCompare(a));

              return (
                <Accordion type="multiple" className="space-y-3">
                  {sortedDays.map((dayKey) => {
                    const dayEntries = entriesByDay[dayKey];
                    const dayDate = new Date(dayKey);
                    const dayTotalHours = dayEntries.reduce((sum, entry) => {
                      return sum + (entry.time_entry_segments?.reduce((s, seg) => s + seg.hours_decimal, 0) || 0);
                    }, 0);

                    return (
                      <AccordionItem key={dayKey} value={dayKey} className="border rounded-lg bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-5 w-5 text-primary" />
                              <span className="font-semibold text-base">
                                {format(dayDate, 'EEEE, dd MMMM yyyy', { locale: ro })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="text-sm font-bold">
                                {dayTotalHours.toFixed(2)}h
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {dayEntries.length} {dayEntries.length === 1 ? 'pontaj' : 'pontaje'}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-2">
                          <div className="space-y-3">
                            {dayEntries.map((entry) => {
                              const shiftType = getShiftTypeFromNotes(entry.notes);
                              const totalHours = entry.time_entry_segments?.reduce((sum, seg) => sum + seg.hours_decimal, 0) || 0;

                              return (
                                <Card key={entry.id} className="bg-accent/50">
                                  <CardContent className="p-4">
                                    <div className="space-y-3">
                                      {/* Header */}
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                          <span className="font-semibold">
                                            Pontaj #{dayEntries.indexOf(entry) + 1}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {shiftType}
                                          </Badge>
                                          {!entry.clock_out_time && (
                                            <Badge variant="default" className="bg-green-500 text-xs">Activ</Badge>
                                          )}
                                        </div>
                                      </div>

                                      {/* Time Range */}
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">
                                          {format(new Date(entry.clock_in_time), 'HH:mm')}
                                          {entry.clock_out_time && ` - ${format(new Date(entry.clock_out_time), 'HH:mm')}`}
                                        </span>
                                        <span className="font-semibold text-primary">
                                          {totalHours.toFixed(2)}h
                                        </span>
                                      </div>

                                      {/* Segments (if available) */}
                                      {entry.time_entry_segments && entry.time_entry_segments.length > 0 && (
                                        <div className="pt-2 border-t space-y-1">
                                          <div className="text-xs font-medium text-muted-foreground mb-2">Detalii:</div>
                                          {entry.time_entry_segments.map((seg, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs">
                                              <span className="text-muted-foreground capitalize">{seg.segment_type.replace('_', ' ')}</span>
                                              <span className="font-mono">{seg.hours_decimal.toFixed(2)}h × {seg.multiplier}x</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              );
            })()
          )}
        </div>
      </div>

      {/* Correction Dialog */}
      <TimeEntryCorrectionDialog 
        open={correctionDialogOpen} 
        onOpenChange={setCorrectionDialogOpen}
      />
    </div>
  );
};

export default MyTimeEntries;