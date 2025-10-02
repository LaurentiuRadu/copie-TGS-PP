import { useState } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const Timesheet = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data: entries, isLoading } = useOptimizedTimeEntries(selectedDate);
  const isMobile = useIsMobile();

  const getSegmentLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      normal: 'Normal',
      weekend: 'Weekend',
      weekend_night: 'Weekend Noapte',
      holiday: 'Sărbătoare',
      holiday_night: 'Sărbătoare Noapte',
      night: 'Noapte',
    };
    return labels[type] || type;
  };

  const getSegmentColor = (type: string) => {
    const colors: { [key: string]: string } = {
      normal: 'default',
      weekend: 'secondary',
      weekend_night: 'secondary',
      holiday: 'destructive',
      holiday_night: 'destructive',
      night: 'outline',
    };
    return colors[type] || 'default';
  };

  const calculateTotalHours = (entry: any) => {
    if (entry.time_entry_segments && entry.time_entry_segments.length > 0) {
      return entry.time_entry_segments.reduce((sum: number, seg: any) => sum + Number(seg.hours_decimal), 0);
    }
    if (entry.clock_out_time) {
      const diff = new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime();
      return diff / (1000 * 60 * 60);
    }
    return 0;
  };

  const calculateWeightedHours = (entry: any) => {
    if (entry.time_entry_segments && entry.time_entry_segments.length > 0) {
      return entry.time_entry_segments.reduce(
        (sum: number, seg: any) => sum + Number(seg.hours_decimal) * Number(seg.multiplier),
        0
      );
    }
    return calculateTotalHours(entry);
  };

  const formatSegments = (segments: any[]) => {
    if (!segments || segments.length === 0) return '-';
    return segments
      .map((seg) => `${getSegmentLabel(seg.segment_type)}: ${Number(seg.hours_decimal).toFixed(2)}h (${seg.multiplier}x)`)
      .join(', ');
  };

  const prepareExportData = () => {
    if (!entries) return [];
    
    return entries.map((entry) => ({
      Angajat: entry.profiles?.full_name || 'Necunoscut',
      Data: format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro }),
      Intrare: format(new Date(entry.clock_in_time), 'HH:mm'),
      Ieșire: entry.clock_out_time ? format(new Date(entry.clock_out_time), 'HH:mm') : 'În lucru',
      'Ore Totale': calculateTotalHours(entry).toFixed(2),
      'Ore Plătite': calculateWeightedHours(entry).toFixed(2),
      Segmente: formatSegments(entry.time_entry_segments || []),
    }));
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
  const totalPaidHours = filteredEntries.reduce((sum, entry) => sum + calculateWeightedHours(entry), 0);

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
                          <Badge variant="outline">{calculateTotalHours(entry).toFixed(2)}h</Badge>
                          <Badge variant="default">{calculateWeightedHours(entry).toFixed(2)}h plătite</Badge>
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
                      <TableHead>Intrare</TableHead>
                      <TableHead>Ieșire</TableHead>
                      <TableHead className="text-right">Ore Totale</TableHead>
                      <TableHead className="text-right">Ore Plătite</TableHead>
                      <TableHead>Segmente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.profiles?.full_name || 'Necunoscut'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(entry.clock_in_time), 'dd.MM.yyyy', { locale: ro })}
                        </TableCell>
                        <TableCell>{format(new Date(entry.clock_in_time), 'HH:mm')}</TableCell>
                        <TableCell>
                          {entry.clock_out_time ? format(new Date(entry.clock_out_time), 'HH:mm') : (
                            <Badge variant="secondary">În lucru</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {calculateTotalHours(entry).toFixed(2)}h
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {calculateWeightedHours(entry).toFixed(2)}h
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {entry.time_entry_segments && entry.time_entry_segments.length > 0 ? (
                              entry.time_entry_segments.map((seg, idx) => (
                                <Badge key={idx} variant={getSegmentColor(seg.segment_type) as any} className="text-xs">
                                  {getSegmentLabel(seg.segment_type)}: {Number(seg.hours_decimal).toFixed(1)}h ({seg.multiplier}x)
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
