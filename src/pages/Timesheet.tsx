import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { AppHeader } from '@/components/AppHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
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

const Timesheet = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data: entries, isLoading } = useOptimizedTimeEntries(selectedDate);
  const isMobile = useIsMobile();

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
      normal: 'Normal',
      night: 'Noapte',
      saturday: 'Sâmbătă',
      sunday: 'Duminică',
      holiday: 'Sărbătoare',
      holiday_night: 'Sărbătoare Noapte',
    };
    return labels[type] || type;
  };

  const getSegmentColor = (type: string) => {
    const colors: { [key: string]: string } = {
      normal: 'default',
      night: 'outline',
      saturday: 'secondary',
      sunday: 'destructive',
      holiday: 'destructive',
      holiday_night: 'destructive',
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

  const calculateHoursByType = (entry: any) => {
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

    // Priority 1: If marked as "Condus Utilaj", all REAL hours go to Utilaj
    if (isEquipment) {
      hours.utilaj = realTotalHours;
      return hours;
    }

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

        if (type === 'normal') {
          hours.normale += realHours;
        } else if (type === 'night') {
          hours.noapte += realHours;
        } else if (type === 'saturday') {
          hours.sambata += realHours;
        } else if (type === 'sunday' || type === 'holiday' || type === 'holiday_night') {
          hours.sarbatori += realHours;
        }
      });
    }

    return hours;
  };

  const prepareExportData = () => {
    if (!entries) return [];
    
    return entries.map((entry) => {
      const hoursByType = calculateHoursByType(entry);
      return {
        Angajat: entry.profiles?.full_name || 'Necunoscut',
        Data: format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro }),
        Normale: hoursByType.normale > 0 ? hoursByType.normale.toFixed(2) : '-',
        Noapte: hoursByType.noapte > 0 ? hoursByType.noapte.toFixed(2) : '-',
        Sâmbătă: hoursByType.sambata > 0 ? hoursByType.sambata.toFixed(2) : '-',
        'Duminica Sarbatori': hoursByType.sarbatori > 0 ? hoursByType.sarbatori.toFixed(2) : '-',
        Pasager: hoursByType.pasager > 0 ? hoursByType.pasager.toFixed(2) : '-',
        Condus: hoursByType.condus > 0 ? hoursByType.condus.toFixed(2) : '-',
        Utilaj: hoursByType.utilaj > 0 ? hoursByType.utilaj.toFixed(2) : '-',
        CO: '-',
        CM: '-',
        Observații: entry.notes || '-',
        Total: calculateTotalHours(entry).toFixed(2),
      };
    });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    const filename = `Timesheet_${format(selectedDate, 'MMMM_yyyy', { locale: ro })}`;
    exportToExcel(data, filename);
  };

  const handleExportCSV = () => {
    const data = prepareExportData();
    const filename = `Timesheet_${format(selectedDate, 'MMMM_yyyy', { locale: ro })}`;
    exportToCSV(data, filename);
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
    
    const hours = calculateHoursByType(entry);
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
    <div className="min-h-screen bg-background">
      <AppHeader title="Timesheet" />

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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Pontaje Lunare</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Selectează luna
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={ro}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>

                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
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
                  <MobileTableCard key={entry.id}>
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
                        <TableRow key={entry.id}>
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
    </div>
  );
};

export default Timesheet;
