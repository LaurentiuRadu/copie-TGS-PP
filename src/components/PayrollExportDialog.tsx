import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Download, AlertTriangle, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { exportMonthlyPayrollReport } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DailyTimesheetForExport {
  employee_id: string;
  work_date: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  hours_leave: number;
  hours_medical_leave: number;
  notes: string | null;
  profiles?: {
    username: string | null;
    full_name: string | null;
  };
}

interface PayrollExportDialogProps {
  allTimesheets: DailyTimesheetForExport[];
}

export function PayrollExportDialog({ allTimesheets }: PayrollExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isExporting, setIsExporting] = useState(false);

  const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  // Query pentru ore neverificate în ziua selectată
  const { data: unapprovedEntries, isLoading: checkingApproval } = useQuery({
    queryKey: ['unapproved-entries', formattedDate],
    queryFn: async () => {
      if (!formattedDate) return [];
      
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, user_id, approval_status, profiles:user_id(full_name, username)')
        .gte('clock_in_time', `${formattedDate}T00:00:00`)
        .lt('clock_in_time', `${formattedDate}T23:59:59`)
        .neq('approval_status', 'approved');

      if (error) throw error;
      return data || [];
    },
    enabled: !!formattedDate && open,
  });

  // Filtrare timesheets pentru ziua selectată
  const timesheetsForSelectedDate = selectedDate
    ? allTimesheets.filter(ts => ts.work_date === format(selectedDate, 'yyyy-MM-dd'))
    : [];

  // Calculate statistics
  const selectedStats = {
    employees: new Set(timesheetsForSelectedDate.map(t => t.employee_id)).size,
    totalHours: timesheetsForSelectedDate.reduce(
      (sum, t) =>
        sum +
        t.hours_regular +
        t.hours_night +
        t.hours_saturday +
        t.hours_sunday +
        t.hours_holiday +
        t.hours_passenger +
        t.hours_driving +
        t.hours_equipment +
        t.hours_leave +
        t.hours_medical_leave,
      0
    ),
    entries: timesheetsForSelectedDate.length,
  };

  const hasUnapprovedEntries = (unapprovedEntries?.length || 0) > 0;

  const handleExport = async () => {
    if (!selectedDate) {
      toast.error('Selectează o dată pentru export');
      return;
    }

    if (hasUnapprovedEntries) {
      toast.error('Nu poți exporta! Există ore neverificate pentru această zi.', {
        description: `${unapprovedEntries?.length} pontaje trebuie aprobate mai întâi.`,
      });
      return;
    }

    try {
      setIsExporting(true);

      if (timesheetsForSelectedDate.length === 0) {
        toast.error('Nu există date pentru ziua selectată');
        return;
      }

      exportMonthlyPayrollReport(timesheetsForSelectedDate, selectedDate);

      toast.success('Raport generat cu succes!', {
        description: `Fișierul Excel a fost descărcat pentru ${format(selectedDate, 'dd.MM.yyyy', { locale: ro })}.`,
      });

      setOpen(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Eroare la generare raport', {
        description: error.message || 'A apărut o eroare necunoscută',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export Raport Salarizare
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Export Raport Salarizare
          </DialogTitle>
          <DialogDescription>
            Generează raport Excel cu rezumat salarizare pentru ziua selectată
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Selectează Ziua pentru Export</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: ro }) : 'Alege data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className="pointer-events-auto"
                  locale={ro}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Validare Ore Neverificate */}
          {checkingApproval ? (
            <Alert className="bg-muted/50">
              <AlertDescription className="text-sm">
                Se verifică statusul pontajelor...
              </AlertDescription>
            </Alert>
          ) : hasUnapprovedEntries ? (
            <Alert className="bg-destructive/10 border-destructive">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm">
                <div className="font-semibold mb-2">
                  ⚠️ Există {unapprovedEntries?.length} pontaje neverificate pentru această zi!
                </div>
                <div className="text-muted-foreground mb-2">
                  Exportul este blocat până la aprobarea tuturor pontajelor.
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary underline"
                  onClick={() => window.open('/timesheet-verificare', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Deschide Verificare Pontaje
                </Button>
              </AlertDescription>
            </Alert>
          ) : selectedDate && timesheetsForSelectedDate.length === 0 ? (
            <Alert className="bg-muted/50">
              <AlertDescription className="text-sm text-muted-foreground">
                Nu există pontaje aprobate pentru această zi.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                ✅ Toate pontajele pentru această zi sunt aprobate și pot fi exportate.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Statistics */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    Dată selectată:
                  </div>
                  <Badge variant="outline">
                    {selectedDate ? format(selectedDate, 'dd.MM.yyyy', { locale: ro }) : '-'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Angajați cu pontaje:
                  </div>
                  <span className="font-semibold">{selectedStats.employees}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Înregistrări pontaje:
                  </div>
                  <span className="font-semibold">{selectedStats.entries}</span>
                </div>

                <div className="pt-3 border-t flex items-center justify-between">
                  <span className="text-sm font-medium">Total ore:</span>
                  <span className="text-xl font-bold text-primary">
                    {selectedStats.totalHours.toFixed(1)}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <div className="font-semibold text-sm">📊 Raportul va include:</div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• Rezumat per angajat cu ore pe categorii</li>
              <li>• Detalii zilnice pentru fiecare pontaj</li>
              <li>• Format Excel optimizat pentru departamentul salarizare</li>
              <li>• Toate coloanele: Ore Normale, Noapte, Sâmbătă, Duminică, Sărbători, Pasager, Conducere, Echipament, CO, CM</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isExporting}>
            Anulează
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || hasUnapprovedEntries || !selectedDate || timesheetsForSelectedDate.length === 0}
            className="gap-2"
          >
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Generare...' : 'Descarcă Excel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
