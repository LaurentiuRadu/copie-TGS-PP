import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModernCalendar } from '@/components/ui/modern-calendar';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Download, Calendar as CalendarIcon, X } from 'lucide-react';
import { useOptimizedTimeEntries } from '@/hooks/useOptimizedTimeEntries';
import { exportToExcel, exportToCSV } from '@/lib/exportUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTableCard, MobileTableRow } from '@/components/MobileTableCard';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TimeEntryDetailsDialog } from '@/components/TimeEntryDetailsDialog';
import { toast } from '@/hooks/use-toast';

const Timesheet = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [exportEmployee, setExportEmployee] = useState<string>("all");
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [monthTotalCount, setMonthTotalCount] = useState<number>(0);
  const { data: entries, isLoading } = useOptimizedTimeEntries(selectedDate);
  const isMobile = useIsMobile();

  // Extract unique employees for filter dropdown
  const employeesList = useMemo(() => {
    if (!entries) return [];
    const unique = Array.from(new Set(
      entries.map(e => e.profiles?.full_name).filter(Boolean)
    )) as string[];
    return unique.sort();
  }, [entries]);

  // Get total count for the month
  useEffect(() => {
    const fetchMonthCount = async () => {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      
      const { count, error } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .gte('clock_in_time', monthStart.toISOString())
        .lte('clock_in_time', monthEnd.toISOString());
      
      if (!error && count !== null) {
        setMonthTotalCount(count);
      }
    };
    
    fetchMonthCount();
  }, [selectedDate]);

  // Realtime subscription for time entries and segments
  useEffect(() => {
    const channel = supabase
      .channel('timesheet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries'
        },
        () => {
          // Refetch data when time entries change
          window.location.reload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entry_segments'
        },
        () => {
          // Refetch data when segments change
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSegmentLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      normal_day: 'Zi',
      normal_night: 'Noapte',
      weekend_saturday_day: 'Sâmbătă Zi',
      weekend_saturday_night: 'Sâmbătă Noapte',
      weekend_sunday_day: 'Duminică Zi',
      weekend_sunday_night: 'Duminică Noapte',
      holiday_day: 'Sărbătoare Zi',
      holiday_night: 'Sărbătoare Noapte',
      overtime: 'Ore Suplimentare',
    };
    return labels[type] || type;
  };

  const getSegmentColor = (type: string) => {
    const colors: { [key: string]: string } = {
      normal_day: 'default',
      normal_night: 'outline',
      weekend_saturday_day: 'secondary',
      weekend_saturday_night: 'secondary',
      weekend_sunday_day: 'destructive',
      weekend_sunday_night: 'destructive',
      holiday_day: 'destructive',
      holiday_night: 'destructive',
      overtime: 'outline',
    };
    return colors[type] || 'default';
  };

  const calculateTotalHours = (entry: any) => {
    if (entry.time_entry_segments && entry.time_entry_segments.length > 0) {
      // Sum PAID hours (hours_decimal × multiplier)
      return entry.time_entry_segments.reduce(
        (sum: number, seg: any) => sum + Number(seg.hours_decimal) * Number(seg.multiplier),
        0
      );
    }
    if (entry.clock_out_time) {
      const diff = new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime();
      return diff / (1000 * 60 * 60);
    }
    return 0;
  };

  const formatSegments = (segments: any[]) => {
    if (!segments || segments.length === 0) return '-';
    return segments
      .map((seg) => {
        const realHours = Number(seg.hours_decimal);
        const paidHours = realHours * Number(seg.multiplier);
        return `${getSegmentLabel(seg.segment_type)}: ${realHours.toFixed(2)}h → ${paidHours.toFixed(2)}h (${seg.multiplier}x)`;
      })
      .join(', ');
  };

  const calculateHoursByType = (entry: any, username?: string) => {
    const hours = {
      normale: 0,
      noapte: 0,
      sambata: 0,
      sarbatori: 0,
      pasager: 0,
      condus: 0,
      utilaj: 0,
    };

    const notes = entry.notes || '';
    
    // Calculate REAL total hours (not paid hours)
    let realTotalHours = 0;
    if (entry.time_entry_segments && entry.time_entry_segments.length > 0) {
      realTotalHours = entry.time_entry_segments.reduce(
        (sum: number, seg: any) => sum + Number(seg.hours_decimal),
        0
      );
    } else if (entry.clock_out_time) {
      const diff = new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime();
      realTotalHours = diff / (1000 * 60 * 60);
    }

    // Check shift type from notes to determine which category to use
    const isPassenger = notes.toLowerCase().includes('tip: pasager');
    const isDriving = notes.toLowerCase().includes('tip: condus');
    const isEquipment = notes.toLowerCase().includes('condus utilaj');

    // EQUIPMENT_USERS list - cei autorizați să conducă utilaje
    const EQUIPMENT_USERS = ['costacheflorin', 'costachemarius', 'rusugheorghita'];
    const isAuthorizedForEquipment = username && EQUIPMENT_USERS.includes(username.toLowerCase());

    // Priority 1: If marked as "Condus Utilaj" AND user is authorized
    if (isEquipment && isAuthorizedForEquipment) {
      hours.utilaj = realTotalHours;
      return hours;
    }
    
    // If marked as equipment but NOT authorized, ignore the marker and treat as normal shift

    // Priority 2: If shift type is "Pasager", all REAL hours go to Pasager
    if (isPassenger) {
      hours.pasager = realTotalHours;
      return hours;
    }

    // Priority 3: If shift type is "Condus", all REAL hours go to Condus
    if (isDriving) {
      hours.condus = realTotalHours;
      return hours;
    }

    // Default: Normal shifts - distribute REAL hours by time segments
    // Export REAL hours WITHOUT multiplier so Payroll can apply their own
    if (entry.time_entry_segments && entry.time_entry_segments.length > 0) {
      entry.time_entry_segments.forEach((seg: any) => {
        const realHours = Number(seg.hours_decimal); // REAL hours, not paid
        const type = seg.segment_type;

        if (type === 'normal_day') {
          hours.normale += realHours;
        } else if (type === 'normal_night') {
          hours.noapte += realHours;
        } else if (type === 'weekend_saturday_day' || type === 'weekend_saturday_night') {
          hours.sambata += realHours;
        } else if (type === 'weekend_sunday_day' || type === 'weekend_sunday_night' || 
                   type === 'holiday_day' || type === 'holiday_night') {
          hours.sarbatori += realHours;
        }
      });
    }

    return hours;
  };

  const prepareExportData = () => {
    if (!entries || entries.length === 0) return [];
    
    // Apply export filters
    let dataToExport = [...entries];
    
    // Filter by date range
    if (exportDateRange.from) {
      dataToExport = dataToExport.filter(entry => {
        const entryDate = new Date(entry.clock_in_time);
        const from = exportDateRange.from!;
        const to = exportDateRange.to || from; // If only one date, use it as both
        
        return entryDate >= startOfDay(from) && entryDate <= endOfDay(to);
      });
    }
    
    // Filter by employee
    if (exportEmployee && exportEmployee !== "all") {
      dataToExport = dataToExport.filter(entry => 
        entry.profiles?.full_name === exportEmployee
      );
    }
    
    // Group entries by employee + date
    const grouped = dataToExport.reduce((acc, entry) => {
      const employeeName = entry.profiles?.full_name || 'Necunoscut';
      const date = format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro });
      const key = `${employeeName}_${date}`;
      
      if (!acc[key]) {
        acc[key] = {
          employeeName,
          date,
          entries: [],
          allNotes: []
        };
      }
      acc[key].entries.push(entry);
      if (entry.notes) {
        acc[key].allNotes.push(entry.notes);
      }
      return acc;
    }, {} as Record<string, { employeeName: string; date: string; entries: any[]; allNotes: string[] }>);
    
    // Centralize hours for each group
    return Object.values(grouped).map(group => {
      const totals = {
        normale: 0,
        noapte: 0,
        sambata: 0,
        sarbatori: 0,
        pasager: 0,
        condus: 0,
        utilaj: 0,
        total: 0
      };
      
      let firstClockIn = '';
      let lastClockOut = '';
      
      group.entries.forEach((entry, index) => {
        const username = entry.profiles?.username;
        const hours = calculateHoursByType(entry, username);
        totals.normale += hours.normale;
        totals.noapte += hours.noapte;
        totals.sambata += hours.sambata;
        totals.sarbatori += hours.sarbatori;
        totals.pasager += hours.pasager;
        totals.condus += hours.condus;
        totals.utilaj += hours.utilaj;
        
        // Track first clock in and last clock out
        if (index === 0) {
          firstClockIn = format(new Date(entry.clock_in_time), 'HH:mm');
        }
        if (entry.clock_out_time) {
          lastClockOut = format(new Date(entry.clock_out_time), 'HH:mm');
        }
        
        // Calculate total hours for this entry
        totals.total += calculateTotalHours(entry);
      });
      
      return {
        'Angajat': group.employeeName,
        'Data': group.date,
        'Normale': totals.normale > 0 ? totals.normale.toFixed(2) : '-',
        'Noapte': totals.noapte > 0 ? totals.noapte.toFixed(2) : '-',
        'Sâmbătă': totals.sambata > 0 ? totals.sambata.toFixed(2) : '-',
        'Duminica Sarbatori': totals.sarbatori > 0 ? totals.sarbatori.toFixed(2) : '-',
        'Pasager': totals.pasager > 0 ? totals.pasager.toFixed(2) : '-',
        'Condus': totals.condus > 0 ? totals.condus.toFixed(2) : '-',
        'Utilaj': totals.utilaj > 0 ? totals.utilaj.toFixed(2) : '-',
        'CO': firstClockIn || '-',
        'CM': lastClockOut || '-',
        'Observații': group.allNotes.join('; ') || '-',
        'Total': totals.total.toFixed(2)
      };
    });
  };

  const handleExportExcel = () => {
    try {
      const data = prepareExportData();
      if (data.length === 0) {
        toast({ title: 'Nu există date pentru export', variant: 'destructive' });
        return;
      }
      const filename = `Timesheet_${format(selectedDate, 'MMMM_yyyy', { locale: ro })}`;
      exportToExcel(data, filename);
      toast({ title: 'Export Excel finalizat', description: `${data.length} înregistrări au fost exportate.` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Eroare la export Excel', description: 'Te rugăm să încerci din nou.', variant: 'destructive' });
    }
  };

  const handleExportCSV = () => {
    try {
      const data = prepareExportData();
      if (data.length === 0) {
        toast({ title: 'Nu există date pentru export', variant: 'destructive' });
        return;
      }
      const filename = `Timesheet_${format(selectedDate, 'MMMM_yyyy', { locale: ro })}`;
      exportToCSV(data, filename);
      toast({ title: 'Export CSV finalizat', description: `${data.length} înregistrări au fost exportate.` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Eroare la export CSV', description: 'Te rugăm să încerci din nou.', variant: 'destructive' });
    }
  };

  // Helper to prepare export data from entries array
  const prepareExportDataFromEntries = (entriesToExport: any[]) => {
    if (!entriesToExport || entriesToExport.length === 0) return [];
    
    // Group entries by employee + date
    const grouped = entriesToExport.reduce((acc, entry) => {
      const employeeName = entry.profiles?.full_name || 'Necunoscut';
      const date = format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro });
      const key = `${employeeName}_${date}`;
      
      if (!acc[key]) {
        acc[key] = {
          employeeName,
          date,
          entries: [],
          allNotes: []
        };
      }
      acc[key].entries.push(entry);
      if (entry.notes) {
        acc[key].allNotes.push(entry.notes);
      }
      return acc;
    }, {} as Record<string, { employeeName: string; date: string; entries: any[]; allNotes: string[] }>);
    
    // Centralize hours for each group
    return Object.values(grouped).map((group: { employeeName: string; date: string; entries: any[]; allNotes: string[] }) => {
      const totals = {
        normale: 0,
        noapte: 0,
        sambata: 0,
        sarbatori: 0,
        pasager: 0,
        condus: 0,
        utilaj: 0,
        total: 0
      };
      
      let firstClockIn = '';
      let lastClockOut = '';
      
      group.entries.forEach((entry, index) => {
        const username = entry.profiles?.username;
        const hours = calculateHoursByType(entry, username);
        totals.normale += hours.normale;
        totals.noapte += hours.noapte;
        totals.sambata += hours.sambata;
        totals.sarbatori += hours.sarbatori;
        totals.pasager += hours.pasager;
        totals.condus += hours.condus;
        totals.utilaj += hours.utilaj;
        
        // Track first clock in and last clock out
        if (index === 0) {
          firstClockIn = format(new Date(entry.clock_in_time), 'HH:mm');
        }
        if (entry.clock_out_time) {
          lastClockOut = format(new Date(entry.clock_out_time), 'HH:mm');
        }
        
        // Calculate total hours for this entry
        totals.total += calculateTotalHours(entry);
      });
      
      return {
        'Angajat': group.employeeName,
        'Data': group.date,
        'Normale': totals.normale > 0 ? totals.normale.toFixed(2) : '-',
        'Noapte': totals.noapte > 0 ? totals.noapte.toFixed(2) : '-',
        'Sâmbătă': totals.sambata > 0 ? totals.sambata.toFixed(2) : '-',
        'Duminica Sarbatori': totals.sarbatori > 0 ? totals.sarbatori.toFixed(2) : '-',
        'Pasager': totals.pasager > 0 ? totals.pasager.toFixed(2) : '-',
        'Condus': totals.condus > 0 ? totals.condus.toFixed(2) : '-',
        'Utilaj': totals.utilaj > 0 ? totals.utilaj.toFixed(2) : '-',
        'CO': firstClockIn || '-',
        'CM': lastClockOut || '-',
        'Observații': group.allNotes.join('; ') || '-',
        'Total': totals.total.toFixed(2)
      };
    });
  };

  // Export all entries for the month (Excel)
  const handleExportAllExcel = async () => {
    try {
      setIsExportingAll(true);
      toast({ title: 'Se pregătește exportul...', description: 'Vă rugăm așteptați' });
      
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      
      // Fetch all time entries for the month with segments and profiles
      const { data: allEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select(`
          *,
          time_entry_segments (*),
          profiles (id, full_name, username)
        `)
        .gte('clock_in_time', monthStart.toISOString())
        .lte('clock_in_time', monthEnd.toISOString())
        .order('clock_in_time', { ascending: true });
      
      if (entriesError) throw entriesError;
      
      if (!allEntries || allEntries.length === 0) {
        toast({ title: 'Nu există date pentru export', variant: 'destructive' });
        return;
      }
      
      const data = prepareExportDataFromEntries(allEntries);
      const filename = `Timesheet_Complet_${format(selectedDate, 'MMMM_yyyy', { locale: ro })}`;
      exportToExcel(data, filename);
      toast({ 
        title: 'Export complet finalizat', 
        description: `${data.length} înregistrări centralizate au fost exportate.` 
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        title: 'Eroare la export complet', 
        description: 'Te rugăm să încerci din nou.', 
        variant: 'destructive' 
      });
    } finally {
      setIsExportingAll(false);
    }
  };

  // Export all entries for the month (CSV)
  const handleExportAllCSV = async () => {
    try {
      setIsExportingAll(true);
      toast({ title: 'Se pregătește exportul...', description: 'Vă rugăm așteptați' });
      
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      
      // Fetch all time entries for the month with segments and profiles
      const { data: allEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select(`
          *,
          time_entry_segments (*),
          profiles (id, full_name, username)
        `)
        .gte('clock_in_time', monthStart.toISOString())
        .lte('clock_in_time', monthEnd.toISOString())
        .order('clock_in_time', { ascending: true });
      
      if (entriesError) throw entriesError;
      
      if (!allEntries || allEntries.length === 0) {
        toast({ title: 'Nu există date pentru export', variant: 'destructive' });
        return;
      }
      
      const data = prepareExportDataFromEntries(allEntries);
      const filename = `Timesheet_Complet_${format(selectedDate, 'MMMM_yyyy', { locale: ro })}`;
      exportToCSV(data, filename);
      toast({ 
        title: 'Export complet finalizat', 
        description: `${data.length} înregistrări centralizate au fost exportate.` 
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        title: 'Eroare la export complet', 
        description: 'Te rugăm să încerci din nou.', 
        variant: 'destructive' 
      });
    } finally {
      setIsExportingAll(false);
    }
  };

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const filteredEntries = entries?.filter((entry) => {
    const entryDate = new Date(entry.clock_in_time);
    return entryDate >= monthStart && entryDate <= monthEnd;
  }) || [];

  const totalHours = filteredEntries.reduce((sum, entry) => sum + calculateTotalHours(entry), 0);
  // Total paid hours is the same as total hours now (already includes multipliers)
  const totalPaidHours = totalHours;

  // Calculate monthly aggregates by employee
  const employeeAggregates = filteredEntries.reduce((acc: any, entry) => {
    const employeeName = entry.profiles?.full_name || 'Necunoscut';
    if (!acc[employeeName]) {
      acc[employeeName] = {
        name: employeeName,
        entries: 0,
        normale: 0,
        noapte: 0,
        sambata: 0,
        sarbatori: 0,
        pasager: 0,
        condus: 0,
        utilaj: 0,
        total: 0,
      };
    }
    
    const username = entry.profiles?.username;
    const hours = calculateHoursByType(entry, username);
    acc[employeeName].entries += 1;
    acc[employeeName].normale += hours.normale;
    acc[employeeName].noapte += hours.noapte;
    acc[employeeName].sambata += hours.sambata;
    acc[employeeName].sarbatori += hours.sarbatori;
    acc[employeeName].pasager += hours.pasager;
    acc[employeeName].condus += hours.condus;
    acc[employeeName].utilaj += hours.utilaj;
    acc[employeeName].total += calculateTotalHours(entry);
    
    return acc;
  }, {});

  return (
    <AdminLayout title="Timesheet">
      <div className="container mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Pontaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredEntries.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ore Totale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toFixed(2)} ore</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ore Plătite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalPaidHours.toFixed(2)} ore</div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Monthly Summary */}
        {Object.keys(employeeAggregates).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sumar Lunar pe Angajat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.values(employeeAggregates).map((emp: any) => (
                  <div key={emp.name} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-lg">{emp.name}</h3>
                      <Badge variant="outline">{emp.entries} pontaje</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Normale:</span>
                        <span className="ml-2 font-medium">{emp.normale.toFixed(1)}h</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Noapte:</span>
                        <span className="ml-2 font-medium">{emp.noapte.toFixed(1)}h</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sâmbătă:</span>
                        <span className="ml-2 font-medium">{emp.sambata.toFixed(1)}h</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">D/Sărbători:</span>
                        <span className="ml-2 font-medium">{emp.sarbatori.toFixed(1)}h</span>
                      </div>
                      {emp.pasager > 0 && (
                        <div>
                          <span className="text-muted-foreground">Pasager:</span>
                          <span className="ml-2 font-medium">{emp.pasager.toFixed(1)}h</span>
                        </div>
                      )}
                      {emp.condus > 0 && (
                        <div>
                          <span className="text-muted-foreground">Condus:</span>
                          <span className="ml-2 font-medium">{emp.condus.toFixed(1)}h</span>
                        </div>
                      )}
                      {emp.utilaj > 0 && (
                        <div>
                          <span className="text-muted-foreground">Utilaj:</span>
                          <span className="ml-2 font-medium">{emp.utilaj.toFixed(1)}h</span>
                        </div>
                      )}
                      <div className="col-span-2 md:col-span-4 pt-2 border-t">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-2 font-bold text-lg">{emp.total.toFixed(1)}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Export */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle>Pontaje Lunare</CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Selectează luna
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <ModernCalendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={ro}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Export Filters */}
              <div className="border-t pt-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filtre Export:</span>
                    {(exportDateRange.from || exportEmployee !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setExportDateRange({ from: undefined, to: undefined });
                          setExportEmployee("all");
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Resetează
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                    <Select value={exportEmployee} onValueChange={setExportEmployee}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Toți angajații" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toți angajații</SelectItem>
                        {employeesList.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-auto">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {exportDateRange.from ? (
                            exportDateRange.to && exportDateRange.to !== exportDateRange.from ? (
                              `${format(exportDateRange.from, 'dd MMM', { locale: ro })} - ${format(exportDateRange.to, 'dd MMM yyyy', { locale: ro })}`
                            ) : format(exportDateRange.from, 'dd MMM yyyy', { locale: ro })
                          ) : "Selectează perioada"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <ModernCalendar
                          mode="range"
                          selected={exportDateRange}
                          onSelect={(range: any) => setExportDateRange(range || { from: undefined, to: undefined })}
                          locale={ro}
                          numberOfMonths={2}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" disabled={isExportingAll}>
                          <Download className="h-4 w-4 mr-2" />
                          Export complet: {monthTotalCount} înregistrări
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={handleExportAllExcel}
                          disabled={isExportingAll}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export complet (Excel)
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={handleExportAllCSV}
                          disabled={isExportingAll}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export complet (CSV)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {(exportDateRange.from || exportEmployee !== "all") && (
                      <>
                        <Badge variant="outline" className="ml-2">
                          Export filtrat: {prepareExportData().length} înregistrări
                        </Badge>

                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                          <Download className="h-4 w-4 mr-2" />
                          Export Excel
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleExportCSV}>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nu există pontaje pentru această lună
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <div 
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntry(entry);
                      setDetailsOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <MobileTableCard>
                    <MobileTableRow
                      label="Angajat"
                      value={
                        <span className="font-semibold">
                          {entry.profiles?.full_name || 'Necunoscut'}
                        </span>
                      }
                    />
                    <MobileTableRow
                      label="Data"
                      value={format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro })}
                    />
                    <MobileTableRow
                      label="Intrare - Ieșire"
                      value={`${format(new Date(entry.clock_in_time), 'HH:mm')} - ${
                        entry.clock_out_time ? format(new Date(entry.clock_out_time), 'HH:mm') : 'În lucru'
                      }`}
                    />
                    <MobileTableRow
                      label="Ore"
                      value={
                        <div className="flex gap-2">
                          <Badge variant="default">{calculateTotalHours(entry).toFixed(2)}h plătite</Badge>
                        </div>
                      }
                    />
                    {entry.time_entry_segments && entry.time_entry_segments.length > 0 && (
                      <MobileTableRow
                        label="Segmente"
                        value={
                          <div className="flex flex-wrap gap-1">
                            {entry.time_entry_segments.map((seg, idx) => (
                              <Badge key={idx} variant={getSegmentColor(seg.segment_type) as any} className="text-xs">
                                {getSegmentLabel(seg.segment_type)}: {Number(seg.hours_decimal).toFixed(1)}h
                              </Badge>
                            ))}
                          </div>
                        }
                        fullWidth
                      />
                    )}
                    </MobileTableCard>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Angajat</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Normale</TableHead>
                      <TableHead className="text-right">Noapte</TableHead>
                      <TableHead className="text-right">Sâmbătă</TableHead>
                      <TableHead className="text-right">Duminica Sarbatori</TableHead>
                      <TableHead className="text-right">Pasager</TableHead>
                      <TableHead className="text-right">Condus</TableHead>
                      <TableHead className="text-right">Utilaj</TableHead>
                      <TableHead className="text-right">CO</TableHead>
                      <TableHead className="text-right">CM</TableHead>
                      <TableHead>Observații</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => {
                      const hoursByType = calculateHoursByType(entry);
                      return (
                        <TableRow 
                          key={entry.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setDetailsOpen(true);
                          }}
                        >
                          <TableCell className="font-medium">
                            {entry.profiles?.full_name || 'Necunoscut'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro })}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.normale > 0 ? `${hoursByType.normale.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.noapte > 0 ? `${hoursByType.noapte.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.sambata > 0 ? `${hoursByType.sambata.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.sarbatori > 0 ? `${hoursByType.sarbatori.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.pasager > 0 ? `${hoursByType.pasager.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.condus > 0 ? `${hoursByType.condus.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {hoursByType.utilaj > 0 ? `${hoursByType.utilaj.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.notes || '-'}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {calculateTotalHours(entry).toFixed(1)}h
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <TimeEntryDetailsDialog
        entry={selectedEntry}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </AdminLayout>
  );
};

export default Timesheet;
