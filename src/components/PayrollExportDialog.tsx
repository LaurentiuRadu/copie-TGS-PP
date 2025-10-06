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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, Download, Users, Calendar as CalendarIcon } from 'lucide-react';
import { exportMonthlyPayrollReport } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface EmployeeOption {
  id: string;
  name: string;
  totalHours: number;
}

interface PayrollExportDialogProps {
  allTimesheets: DailyTimesheetForExport[];
  employees: EmployeeOption[];
  currentMonth: Date;
}

export function PayrollExportDialog({ allTimesheets, employees, currentMonth }: PayrollExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const monthName = currentMonth.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  // Calculate statistics
  const selectedStats = selectedEmployee === 'all' 
    ? {
        employees: employees.length,
        totalHours: employees.reduce((sum, e) => sum + e.totalHours, 0),
        days: new Set(allTimesheets.map(t => t.work_date)).size
      }
    : {
        employees: 1,
        totalHours: employees.find(e => e.id === selectedEmployee)?.totalHours || 0,
        days: new Set(allTimesheets.filter(t => t.employee_id === selectedEmployee).map(t => t.work_date)).size
      };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const employeeId = selectedEmployee === 'all' ? undefined : selectedEmployee;
      
      exportMonthlyPayrollReport(allTimesheets, currentMonth, employeeId);
      
      toast.success('Raport generat cu succes!', {
        description: `Fișierul Excel a fost descărcat.`
      });
      
      setOpen(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Eroare la generare raport', {
        description: error.message || 'A apărut o eroare necunoscută'
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
            Generează raport Excel cu rezumat salarizare pentru luna {monthName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Selectează Angajat</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Tot Personalul ({employees.length} angajați)
                  </div>
                </SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} - {emp.totalHours.toFixed(1)}h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview Statistics */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    Perioadă:
                  </div>
                  <Badge variant="outline">{monthName}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Angajați:
                  </div>
                  <span className="font-semibold">{selectedStats.employees}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    Zile lucrate:
                  </div>
                  <span className="font-semibold">{selectedStats.days}</span>
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
              <li>• Calcul ore plătibile cu multiplicatori (1.0x, 1.25x, 1.5x, 2.0x)</li>
              <li>• Detalii zilnice pentru fiecare pontaj</li>
              <li>• Format Excel optimizat pentru departamentul salarizare</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isExporting}>
            Anulează
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Generare...' : 'Descarcă Excel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
