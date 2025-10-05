import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Clock, User, Calendar, MapPin, FileText, Clock3, TrendingUp } from 'lucide-react';

interface TimeEntryDetailsDialogProps {
  entry: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TimeEntryDetailsDialog = ({ entry, open, onOpenChange }: TimeEntryDetailsDialogProps) => {
  if (!entry) return null;

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
      normal_night: 'secondary',
      weekend_saturday_day: 'outline',
      weekend_saturday_night: 'outline',
      weekend_sunday_day: 'destructive',
      weekend_sunday_night: 'destructive',
      holiday_day: 'destructive',
      holiday_night: 'destructive',
      overtime: 'secondary',
    };
    return colors[type] || 'default';
  };

  // Parse manual markers from notes
  const parseManualMarkers = () => {
    const notes = entry.notes || '';
    const markers = {
      shiftType: null as string | null,
      equipment: [] as string[],
      passenger: [] as string[],
      driving: [] as string[],
    };

    // Check shift type
    if (notes.toLowerCase().includes('tip: pasager')) {
      markers.shiftType = 'Pasager';
    } else if (notes.toLowerCase().includes('tip: condus')) {
      markers.shiftType = 'Condus';
    }

    // Parse equipment intervals
    const equipmentMatches = notes.matchAll(/condus utilaj: (\d{2}:\d{2}) - (\d{2}:\d{2})/gi);
    for (const match of equipmentMatches) {
      markers.equipment.push(`${match[1]} - ${match[2]}`);
    }

    // Parse passenger intervals
    const passengerMatches = notes.matchAll(/pasager: (\d{2}:\d{2}) - (\d{2}:\d{2})/gi);
    for (const match of passengerMatches) {
      markers.passenger.push(`${match[1]} - ${match[2]}`);
    }

    // Parse driving intervals
    const drivingMatches = notes.matchAll(/condus: (\d{2}:\d{2}) - (\d{2}:\d{2})/gi);
    for (const match of drivingMatches) {
      markers.driving.push(`${match[1]} - ${match[2]}`);
    }

    return markers;
  };

  const markers = parseManualMarkers();

  // Calculate totals by category
  const calculateCategoryTotals = () => {
    const totals = {
      normale: 0,
      noapte: 0,
      sambata: 0,
      sarbatori: 0,
      realTotal: 0,
      paidTotal: 0,
    };

    if (entry.time_entry_segments && entry.time_entry_segments.length > 0) {
      entry.time_entry_segments.forEach((seg: any) => {
        const realHours = Number(seg.hours_decimal);
        const paidHours = realHours * Number(seg.multiplier);
        const type = seg.segment_type;

        totals.realTotal += realHours;
        totals.paidTotal += paidHours;

        if (type === 'normal_day') {
          totals.normale += realHours;
        } else if (type === 'normal_night') {
          totals.noapte += realHours;
        } else if (type === 'weekend_saturday_day' || type === 'weekend_saturday_night') {
          totals.sambata += realHours;
        } else if (type === 'weekend_sunday_day' || type === 'weekend_sunday_night' || 
                   type === 'holiday_day' || type === 'holiday_night') {
          totals.sarbatori += realHours;
        }
      });
    } else if (entry.clock_out_time) {
      const diff = new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime();
      totals.realTotal = diff / (1000 * 60 * 60);
      totals.paidTotal = totals.realTotal;
    }

    return totals;
  };

  const totals = calculateCategoryTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-primary" />
            Detalii Pontaj
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* General Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informații Generale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Angajat:</span>
                <span className="font-semibold">{entry.profiles?.full_name || 'Necunoscut'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Data:</span>
                <span className="font-semibold">
                  {format(new Date(entry.clock_in_time), 'dd MMMM yyyy', { locale: ro })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Interval:</span>
                <span className="font-semibold">
                  {format(new Date(entry.clock_in_time), 'HH:mm')} - {' '}
                  {entry.clock_out_time ? format(new Date(entry.clock_out_time), 'HH:mm') : 'În lucru'}
                </span>
              </div>
              {entry.notes && (
                <div className="flex items-start gap-2 pt-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm text-muted-foreground">Observații:</span>
                    <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{entry.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Markers */}
          {(markers.shiftType || markers.equipment.length > 0 || markers.passenger.length > 0 || markers.driving.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Marcaje Manuale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {markers.shiftType && (
                  <div>
                    <span className="text-sm text-muted-foreground">Tip Tură:</span>
                    <Badge variant="outline" className="ml-2">{markers.shiftType}</Badge>
                  </div>
                )}
                {markers.equipment.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Condus Utilaj:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {markers.equipment.map((interval, idx) => (
                        <Badge key={idx} variant="secondary">{interval}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {markers.passenger.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Pasager:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {markers.passenger.map((interval, idx) => (
                        <Badge key={idx} variant="secondary">{interval}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {markers.driving.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Condus:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {markers.driving.map((interval, idx) => (
                        <Badge key={idx} variant="secondary">{interval}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Time Segments Timeline */}
          {entry.time_entry_segments && entry.time_entry_segments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Timeline Segmente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {entry.time_entry_segments.map((seg: any, idx: number) => {
                    const realHours = Number(seg.hours_decimal);
                    const paidHours = realHours * Number(seg.multiplier);
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-mono text-muted-foreground">
                            {format(new Date(seg.start_time), 'HH:mm')} - {format(new Date(seg.end_time), 'HH:mm')}
                          </div>
                          <Badge variant={getSegmentColor(seg.segment_type) as any}>
                            {getSegmentLabel(seg.segment_type)}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {realHours.toFixed(2)}h
                            {Number(seg.multiplier) !== 1 && (
                              <span className="text-muted-foreground ml-1">
                                × {seg.multiplier}
                              </span>
                            )}
                          </div>
                          {Number(seg.multiplier) !== 1 && (
                            <div className="text-xs text-primary font-semibold">
                              = {paidHours.toFixed(2)}h plătite
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Totaluri pe Categorii
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {totals.normale > 0 && (
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-sm text-muted-foreground">Ore Normale:</span>
                    <span className="font-semibold">{totals.normale.toFixed(2)}h</span>
                  </div>
                )}
                {totals.noapte > 0 && (
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-sm text-muted-foreground">Ore Noapte:</span>
                    <span className="font-semibold">{totals.noapte.toFixed(2)}h</span>
                  </div>
                )}
                {totals.sambata > 0 && (
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-sm text-muted-foreground">Ore Sâmbătă:</span>
                    <span className="font-semibold">{totals.sambata.toFixed(2)}h</span>
                  </div>
                )}
                {totals.sarbatori > 0 && (
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-sm text-muted-foreground">Ore Sărbători:</span>
                    <span className="font-semibold">{totals.sarbatori.toFixed(2)}h</span>
                  </div>
                )}
              </div>
              
              <Separator className="my-4" />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded">
                  <span className="text-sm font-medium">Total Ore Reale:</span>
                  <span className="font-bold text-lg">{totals.realTotal.toFixed(2)}h</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/20 rounded">
                  <span className="text-sm font-medium">Total Ore Plătite:</span>
                  <span className="font-bold text-lg text-primary">{totals.paidTotal.toFixed(2)}h</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Info */}
          {(entry.clock_in_latitude || entry.clock_out_latitude) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Locații GPS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {entry.clock_in_latitude && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Intrare:</span>
                    <span className="ml-2 font-mono text-xs">
                      {Number(entry.clock_in_latitude).toFixed(6)}, {Number(entry.clock_in_longitude).toFixed(6)}
                    </span>
                  </div>
                )}
                {entry.clock_out_latitude && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Ieșire:</span>
                    <span className="ml-2 font-mono text-xs">
                      {Number(entry.clock_out_latitude).toFixed(6)}, {Number(entry.clock_out_longitude).toFixed(6)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
