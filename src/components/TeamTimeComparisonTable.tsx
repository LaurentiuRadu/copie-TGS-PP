import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Check, X, CheckCircle2, Plus, AlertCircle, Clock, Info, Calendar, Car, Users, Settings, Moon, PartyPopper, ClipboardList, BarChart, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { formatRomania } from '@/lib/timezone';
import { normalizeTimeInput } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { EmployeeCard } from '@/components/TeamApproval/EmployeeCard';
import { getSegmentIcon, getSegmentLabel, getSegmentColors } from '@/lib/segments';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { EmployeeDayData, Segment } from '@/types/timeApproval';

interface TeamTimeComparisonTableProps {
  groupedByEmployee: EmployeeDayData[];
  onEdit: (entry: any) => void;
  onDelete: (entry: any) => void;
  onApprove: (entryId: string) => void;
  onUniformize: () => void;
  onTimeClick: (userId: string, segmentIndex: number, segmentId: string, field: 'startTime' | 'endTime', currentTime: string) => void;
  editingSegment: {
    userId: string;
    segmentIndex: number;
    segmentId: string;
    field: 'startTime' | 'endTime';
    value: string;
  } | null;
  onTimeChange: (value: string) => void;
  onTimeSave: (employee: EmployeeDayData) => void;
  onTimeCancel: () => void;
  onSegmentHoursEdit: (userId: string, segmentType: string, hours: number) => void;
  onClockInEdit?: (employee: EmployeeDayData) => void;
  onClockOutEdit?: (employee: EmployeeDayData) => void;
  onAddManualEntry?: (employee: EmployeeDayData) => void;
  selectedWeek: string; // ✅ ADĂUGAT
  selectedDayOfWeek: number; // ✅ ADĂUGAT
}

// ✅ SegmentBadge component moved to top-level to fix Hook rules violation
const SegmentBadge = React.memo(({ 
  type, 
  hours, 
  icon,
  onClick 
}: { 
  type: string; 
  hours: number; 
  icon: React.ReactNode;
  onClick?: () => void;
}) => {
  return (
    <Badge 
      className={`${getSegmentColors(type)} gap-1.5 text-xs font-medium px-2.5 py-1 cursor-pointer hover:opacity-90 transition-opacity`}
      onClick={onClick}
    >
      {icon}
      <span>{getSegmentLabel(type)}</span>
      <span className="font-mono font-semibold">{hours.toFixed(1)}h</span>
    </Badge>
  );
});

SegmentBadge.displayName = 'SegmentBadge';

export const TeamTimeComparisonTable = ({
  groupedByEmployee,
  onEdit,
  onDelete,
  onApprove,
  onUniformize,
  onTimeClick,
  editingSegment,
  onTimeChange,
  onTimeSave,
  onTimeCancel,
  onSegmentHoursEdit,
  onClockInEdit,
  onClockOutEdit,
  onAddManualEntry,
  selectedWeek, // ✅ ADĂUGAT
  selectedDayOfWeek, // ✅ ADĂUGAT
}: TeamTimeComparisonTableProps) => {
  const [editingHours, setEditingHours] = useState<{
    userId: string;
    segmentType: string;
    value: string;
  } | null>(null);
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Detectează șoferii (cei care conduc efectiv)
  const isDriver = (segments: Segment[]) => {
    return segments.some(s => s.type === 'hours_driving' || s.type === 'hours_equipment');
  };

  // Helper pentru calcul discrepanță Clock In
  const getClockInDiscrepancy = (employee: EmployeeDayData): number => {
    const nonDrivers = groupedByEmployee.filter(emp => !isDriver(emp.segments));
    if (nonDrivers.length === 0) return 0;
    
    const avgMinutes = nonDrivers.reduce((sum, emp) => {
      const clockIn = new Date(emp.firstClockIn);
      return sum + clockIn.getHours() * 60 + clockIn.getMinutes();
    }, 0) / nonDrivers.length;
    
    const empClockIn = new Date(employee.firstClockIn);
    const empMinutes = empClockIn.getHours() * 60 + empClockIn.getMinutes();
    
    return empMinutes - avgMinutes;
  };

  // Calculează media echipei (exclude șoferii)
  const calculateTeamAverage = () => {
    const nonDrivers = groupedByEmployee.filter(emp => !isDriver(emp.segments) && !emp.isMissing && emp.firstClockIn);
    
    if (nonDrivers.length === 0) {
      return { avgClockIn: null, avgClockOut: null, avgHours: 0 };
    }

    const clockIns = nonDrivers
      .map(emp => {
        const date = new Date(emp.firstClockIn);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        // ✅ Validare: verifică dacă valorile sunt valide
        if (isNaN(hours) || isNaN(minutes)) return null;
        return hours * 60 + minutes;
      })
      .filter((m): m is number => m !== null); // Exclude valorile null

    const clockOuts = nonDrivers
      .filter(emp => emp.lastClockOut)
      .map(emp => {
        const date = new Date(emp.lastClockOut!);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        // ✅ Validare: verifică dacă valorile sunt valide
        if (isNaN(hours) || isNaN(minutes)) return null;
        return hours * 60 + minutes;
      })
      .filter((m): m is number => m !== null); // Exclude valorile null

    // ✅ Verificare: dacă nu avem date valide, returnează null
    if (clockIns.length === 0) {
      return { avgClockIn: null, avgClockOut: null, avgHours: 0 };
    }

    const avgClockInMinutes = Math.round(clockIns.reduce((a, b) => a + b, 0) / clockIns.length);
    const avgClockOutMinutes = clockOuts.length > 0 
      ? Math.round(clockOuts.reduce((a, b) => a + b, 0) / clockOuts.length)
      : null;

    // ✅ Validare finală: verifică NaN înainte de formatare
    const avgClockIn = !isNaN(avgClockInMinutes) && isFinite(avgClockInMinutes)
      ? `${Math.floor(avgClockInMinutes / 60).toString().padStart(2, '0')}:${(avgClockInMinutes % 60).toString().padStart(2, '0')}`
      : null;
    
    const avgClockOut = avgClockOutMinutes !== null && !isNaN(avgClockOutMinutes) && isFinite(avgClockOutMinutes)
      ? `${Math.floor(avgClockOutMinutes / 60).toString().padStart(2, '0')}:${(avgClockOutMinutes % 60).toString().padStart(2, '0')}`
      : null;

    const avgHours = nonDrivers.reduce((sum, emp) => sum + emp.totalHours, 0) / nonDrivers.length;

    return { avgClockIn, avgClockOut, avgHours: isNaN(avgHours) ? 0 : avgHours };
  };

  // ✅ FIX 5: Memoizare teamAverage pentru a evita recalcul la fiecare render
  const teamAverage = React.useMemo(() => calculateTeamAverage(), [groupedByEmployee]);

  // Calculează diferența în minute
  const getTimeDifferenceMinutes = (time: string, avgTime: string | null): number => {
    if (!avgTime) return 0;
    
    const [h1, m1] = time.split(':').map(Number);
    const [h2, m2] = avgTime.split(':').map(Number);
    
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    
    return Math.abs(minutes1 - minutes2);
  };

  // Determină culoarea pe baza diferenței
  const getDiscrepancyColor = (time: string, avgTime: string | null, isDriver: boolean): string => {
    if (isDriver || !avgTime) return '';
    
    const diff = getTimeDifferenceMinutes(time, avgTime);
    
    if (diff <= 15) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30';
    if (diff <= 30) return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/30';
    return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30';
  };

  // Format diferență
  const formatDifference = (time: string, avgTime: string | null): string => {
    if (!avgTime || !time) return '';
    
    // ✅ Validare: verifică format valid înainte de procesare
    const timeParts = time.split(':');
    const avgParts = avgTime.split(':');
    if (timeParts.length !== 2 || avgParts.length !== 2) return '';
    
    const [h1, m1] = timeParts.map(Number);
    const [h2, m2] = avgParts.map(Number);
    
    // ✅ Validare: verifică că valorile sunt numere valide
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return '';
    
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    const diff = Math.abs(minutes1 - minutes2);
    
    // ✅ Validare finală: verifică NaN
    if (isNaN(diff) || !isFinite(diff)) return '';
    
    const sign = minutes1 >= minutes2 ? '+' : '-';
    return `${sign}${diff}min`;
  };

  const getSegmentIcon = (type: string) => {
    switch(type) {
      case 'hours_driving': return <Car className="h-3.5 w-3.5" />;
      case 'hours_passenger': return <Users className="h-3.5 w-3.5" />;
      case 'hours_equipment': return <Settings className="h-3.5 w-3.5" />;
      case 'hours_night': return <Moon className="h-3.5 w-3.5" />;
      case 'hours_holiday': return <PartyPopper className="h-3.5 w-3.5" />;
      case 'hours_regular': return <Settings className="h-3.5 w-3.5" />;
      default: return <ClipboardList className="h-3.5 w-3.5" />;
    }
  };

  const getSegmentLabel = (type: string) => {
    switch(type) {
      case 'hours_driving': return 'Condus';
      case 'hours_passenger': return 'Pasager';
      case 'hours_equipment': return 'Utilaj';
      case 'hours_night': return 'Noapte';
      case 'hours_holiday': return 'Sărbătoare';
      case 'hours_regular': return 'Normal';
      case 'hours_saturday': return 'Sâmbătă';
      case 'hours_sunday': return 'Duminică';
      default: return type;
    }
  };

  // Calculează diferența dintre Clock In/Out și Total Ore alocate (în minute)
  const getHoursDiscrepancyMinutes = (employee: EmployeeDayData): number | null => {
    if (!employee.firstClockIn || !employee.lastClockOut) return null;
    
    const rawDurationMs = new Date(employee.lastClockOut).getTime() - new Date(employee.firstClockIn).getTime();
    const rawDurationHours = rawDurationMs / (1000 * 60 * 60);
    const discrepancyHours = Math.abs(rawDurationHours - employee.totalHours);
    
    return Math.round(discrepancyHours * 60); // Convert to minutes
  };

  // Helper pentru a calcula total ore pe tip segment
  const getSegmentHours = (segments: Segment[], type: string): number => {
    return segments
      .filter(s => s.type === type)
      .reduce((sum, s) => sum + s.duration, 0);
  };

  // Helper pentru a obține orele de afișat (override manual sau calculate din segmente)
  const getDisplayHours = (employee: EmployeeDayData, type: string): number => {
    if (employee.overrideHours && employee.manualOverride) {
      return employee.overrideHours[type as keyof typeof employee.overrideHours] || 0;
    }
    return getSegmentHours(employee.segments, type);
  };

  // Helper pentru editabilitate condiționată
  const isSegmentEditable = (employee: EmployeeDayData, segmentType: string): boolean => {
    const currentHours = getDisplayHours(employee, segmentType);
    // Editabil doar dacă există ore calculate (> 0) SAU există override manual explicit
    return currentHours > 0 || employee.manualOverride || false;
  };

  // Handler pentru salvare ore segment cu VALIDARE STRICTĂ
  const handleSaveSegmentHours = async (userId: string, segmentType: string, newHours: number) => {
    const employee = groupedByEmployee.find(e => e.userId === userId);
    if (!employee) return;
    
    // ✅ STEP 1: Calculează durata brută pontaj (clock_in → clock_out)
    const clockInTime = new Date(employee.firstClockIn);
    const clockOutTime = new Date(employee.lastClockOut || employee.firstClockIn);
    const durataBrutaOre = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    
    // ✅ STEP 2: Definește tipuri segmente (exclude hours_regular, leave, medical_leave)
    const segmentTypesManuale = [
      'hours_passenger', 
      'hours_driving', 
      'hours_equipment', 
      'hours_night', 
      'hours_saturday', 
      'hours_sunday', 
      'hours_holiday'
    ];
    
    const segmentTypes = ['hours_regular', ...segmentTypesManuale, 'hours_leave', 'hours_medical_leave'];
    
    // Calculează suma orelor MANUALE după modificare
    const oreManuale = segmentTypesManuale.reduce((sum, t) => {
      const hours = (t === segmentType) ? newHours : getDisplayHours(employee, t);
      return sum + hours;
    }, 0);
    
    // ✅ STEP 3: Validare strictă cu toleranță 0.05h (3 minute pentru rotunjiri)
    const TOLERANCE = 0.05;
    
    if (oreManuale > durataBrutaOre + TOLERANCE) {
      toast({
        variant: 'destructive',
        title: '❌ Eroare Validare Ore',
        description: `Orele introduse (${oreManuale.toFixed(2)}h) depășesc durata pontajului (${durataBrutaOre.toFixed(2)}h)!\n\nVerifică valorile pentru: Pasager, Condus, Utilaj, Noapte.`,
        duration: 5000,
      });
      return;
    }
    
    // ✅ STEP 4: Auto-calculează hours_regular
    const hoursRegularCalculated = Math.max(0, durataBrutaOre - oreManuale);
    
    const workDate = format(new Date(employee.firstClockIn), 'yyyy-MM-dd');

    // ✅ FIX CRITICAL: Obține valorile EXISTENTE din daily_timesheets
    const { data: existingTimesheet } = await supabase
      .from('daily_timesheets')
      .select('*')
      .eq('employee_id', userId)
      .eq('work_date', workDate)
      .maybeSingle();

    // Funcție helper pentru override manual
    const saveAdminOverride = async () => {
      console.log('[🔍 SAVE SEGMENT DEBUG] Starting saveAdminOverride:', {
        userId,
        segmentType,
        newHours,
        workDate,
        existingTimesheetExists: !!existingTimesheet,
        existingTimesheetId: existingTimesheet?.id,
      });

      const overridePayload: any = {
        employee_id: userId,
        work_date: workDate,
        notes: employee.manualOverride 
          ? '[SEGMENTARE VALIDATĂ] Actualizat din tabel (mod manual)'
          : '[SEGMENTARE VALIDATĂ] Setat manual din tabel',
      };
      
      console.log('[🔍 SAVE] Editing segment:', { segmentType, newHours, userId, workDate, existingTimesheet: existingTimesheet ? 'EXISTS' : 'NULL' });

      // ✅ FIX CRITICAL: Strategie unificată pentru construire payload
      // 1. hours_regular → auto-calculat mereu (durata brută - ore manuale)
      // 2. Segment editat → valoarea nouă
      // 3. Există în DB → păstrează din DB (chiar dacă e 0)
      // 4. Nu există în DB → calculează din segmente

      segmentTypes.forEach((t) => {
        if (t === 'hours_regular') {
          // Auto-calculată mereu din durata brută
          overridePayload[t] = Number(hoursRegularCalculated.toFixed(2));
          console.log(`[✅ AUTO] ${t} = ${hoursRegularCalculated.toFixed(2)}`);
        } else if (t === segmentType) {
          // ✅ Valoarea editată - PRIORITATE MAXIMĂ
          overridePayload[t] = Number(newHours.toFixed(2));
          console.log(`[✅ EDITED] ${t} = ${newHours.toFixed(2)}`);
        } else {
          // ✅ CRITICĂ: Pentru celelalte segmente, păstrează din DB sau calculează
          if (existingTimesheet && (t in existingTimesheet)) {
            // Păstrează valoarea din DB (chiar dacă e 0 sau NULL)
            const dbValue = existingTimesheet[t as keyof typeof existingTimesheet] ?? 0;
            overridePayload[t] = Number(dbValue);
            console.log(`[📦 PRESERVED] ${t} = ${dbValue} (from DB - protected)`);
          } else {
            // Calculează din segmente DOAR dacă nu există în DB
            const displayValue = getDisplayHours(employee, t);
            overridePayload[t] = Number(displayValue.toFixed(2));
            console.log(`[🔢 CALCULATED] ${t} = ${displayValue.toFixed(2)} (from segments)`);
          }
        }
      });
      
      console.log('[🔍 SAVE] Final payload:', overridePayload);

      console.log('[🔍 SAVE SEGMENT DEBUG] Complete overridePayload:', overridePayload);

      console.log('[🔍 SAVE] Upserting to daily_timesheets...');

      if (existingTimesheet) {
        // ✅ FIX: Verificare optimistă concurență prin updated_at
        const { error: updateError } = await supabase
          .from('daily_timesheets')
          .update(overridePayload)
          .eq('id', existingTimesheet.id)
          .eq('updated_at', existingTimesheet.updated_at); // ✅ Optimistic lock

        if (updateError) {
          console.error('[❌ UPDATE ERROR]', updateError);
          throw new Error('Conflict: Datele au fost modificate între timp. Reîncarcă pagina.');
        }
        console.log('[✅ UPDATE SUCCESS] ID:', existingTimesheet.id);
      } else {
        const { error: insertError } = await supabase
          .from('daily_timesheets')
          .insert(overridePayload);

        if (insertError) {
          console.error('[❌ INSERT ERROR]', insertError);
          throw insertError;
        }
        console.log('[✅ INSERT SUCCESS]');
      }

      // Optimistic update cache
      queryClient.setQueryData(
        QUERY_KEYS.dailyTimesheets(new Date(workDate)),
        (oldData: any[] | undefined) => {
          if (!oldData) return oldData;
          
          const existingIndex = oldData.findIndex(
            dt => dt.employee_id === userId && dt.work_date === workDate
          );
          
          if (existingIndex >= 0) {
            const newData = [...oldData];
            newData[existingIndex] = {
              ...newData[existingIndex],
              ...overridePayload,
              updated_at: new Date().toISOString(),
            };
            return newData;
          } else {
            return [...oldData, { id: crypto.randomUUID(), ...overridePayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
          }
        }
      );

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });

      toast({
        title: '✅ Override salvat',
        description: `${getSegmentLabel(segmentType)}: ${newHours.toFixed(2)}h (validat)`,
      });

      setEditingHours(null);
    };

    // Dacă e Manual Override, salvăm DIRECT
    if (employee.manualOverride) {
      await saveAdminOverride();
      return;
    }

    // Pentru segmente non-regular, aplicăm logica de rebalansare
    if (segmentType !== 'hours_regular') {
      // Recalculăm regular automat
      onSegmentHoursEdit(userId, 'hours_regular', Number(hoursRegularCalculated.toFixed(2)));
      onSegmentHoursEdit(userId, segmentType, Number(newHours.toFixed(2)));
      setEditingHours(null);
      return;
    }

    // Pentru hours_regular: acceptăm valoarea calculată automat
    onSegmentHoursEdit(userId, 'hours_regular', Number(hoursRegularCalculated.toFixed(2)));
    setEditingHours(null);
  };

  return (
    <div className="space-y-4">
      {/* Header cu buton uniformizare */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Comparație Pontaje</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Info className="h-3.5 w-3.5" />
            <span>Legenda: Verde ≤15min | Galben 15-30min | Roșu &gt;30min diferență</span>
          </p>
        </div>
        {groupedByEmployee.some(emp => !isDriver(emp.segments)) && (
          <Button onClick={onUniformize} variant="secondary" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Uniformizează Orele
          </Button>
        )}
      </div>

      {/* Mobile Card View */}
      {isMobile ? (
        <div className="space-y-3">
          {groupedByEmployee.map((employee) => {
            const isDrv = isDriver(employee.segments);
            
            return (
              <EmployeeCard
                key={employee.userId}
                employee={employee}
                teamAverage={{
                  clockIn: teamAverage.avgClockIn || '00:00',
                  clockOut: teamAverage.avgClockOut || '00:00',
                  totalHours: teamAverage.avgHours,
                }}
                isDriver={isDrv}
                onEdit={() => employee.entries[0] && onEdit(employee.entries[0])}
                onDelete={() => employee.entries[0] && onDelete(employee.entries[0])}
                onApprove={() => employee.entries[0] && onApprove(employee.entries[0].id)}
                onAddManualEntry={() => onAddManualEntry?.(employee)}
                onClockInEdit={() => onClockInEdit?.(employee)}
                onClockOutEdit={() => onClockOutEdit?.(employee)}
                onSegmentClick={(segmentType, hours) => {
                  if (isAdmin && isSegmentEditable(employee, segmentType)) {
                    setEditingHours({
                      userId: employee.userId,
                      segmentType,
                      value: hours.toString(),
                    });
                  }
                }}
                isAdmin={isAdmin}
              />
            );
          })}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="border rounded-lg overflow-x-auto">
        <Table className="w-full min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Angajat</TableHead>
              <TableHead className="min-w-[120px]">Clock In</TableHead>
              <TableHead className="min-w-[120px]">Clock Out</TableHead>
              <TableHead className="min-w-[500px]">Fragmentare</TableHead>
              <TableHead className="min-w-[100px]">Total Ore</TableHead>
              <TableHead className="min-w-[150px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Rând media echipei */}
            {teamAverage.avgClockIn && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-primary" />
                    <span>Media Echipei</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">
                    (exclude șoferii)
                  </div>
                </TableCell>
                <TableCell>{teamAverage.avgClockIn}</TableCell>
                <TableCell>{teamAverage.avgClockOut || '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="gap-1.5 text-xs">
                      <span>⚙️</span>
                      <span>Media echipei (exclude șoferii)</span>
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{teamAverage.avgHours.toFixed(2)}h</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
              </TableRow>
            )}

            {/* Rânduri angajați */}
            {groupedByEmployee.map((employee) => {
              // ✅ SPECIAL CASE: Angajat lipsă
              if (employee.isMissing) {
                return (
                  <TableRow 
                    key={employee.userId} 
                    className="bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500 hover:bg-red-100 dark:hover:bg-red-950/30"
                  >
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div>
                          <p className="text-red-700 dark:text-red-400">{employee.fullName}</p>
                          <p className="text-xs text-red-600 dark:text-red-500">
                            @{employee.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {(() => {
                        // Calculăm data zilei selectate
                        const weekStart = new Date(selectedWeek);
                        const dayDate = new Date(weekStart);
                        dayDate.setDate(dayDate.getDate() + (selectedDayOfWeek - 1));
                        const isFutureDate = dayDate > new Date();
                        
                        return isFutureDate ? (
                          <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                            <Calendar className="h-3 w-3" />
                            Programat
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="h-3 w-3" />
                            NU S-A PONTAJAT
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell colSpan={2}>
                      <div className="text-xs text-muted-foreground">
                        {employee.scheduled_location && `📍 ${employee.scheduled_location}`}
                        {employee.scheduled_activity && ` • ${employee.scheduled_activity}`}
                      </div>
                    </TableCell>

                    <TableCell colSpan={2} className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-red-300 hover:bg-red-50"
                        onClick={() => onAddManualEntry?.(employee)}
                      >
                        <Plus className="h-4 w-4" />
                        Adaugă Pontaj Manual
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }

              const isDrv = isDriver(employee.segments);
              const clockInTime = formatRomania(employee.firstClockIn, 'HH:mm');
              const clockOutTime = employee.lastClockOut ? formatRomania(employee.lastClockOut, 'HH:mm') : '—';
              
              const clockInColor = getDiscrepancyColor(clockInTime, teamAverage.avgClockIn, isDrv);
              const clockOutColor = employee.lastClockOut 
                ? getDiscrepancyColor(clockOutTime, teamAverage.avgClockOut, isDrv)
                : '';
              
              const clockInDiff = formatDifference(clockInTime, teamAverage.avgClockIn);
              const clockOutDiff = employee.lastClockOut && teamAverage.avgClockOut
                ? formatDifference(clockOutTime, teamAverage.avgClockOut)
                : '';

              return (
                <TableRow key={employee.userId}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{employee.fullName}</span>
                        
                        {/* Badge discrepanță Clock In - DOAR dacă NU e manual override */}
                        {!employee.manualOverride && (() => {
                          const discrepancyMin = getClockInDiscrepancy(employee);
                          if (!isDrv && Math.abs(discrepancyMin) > 30) {
                            return (
                              <Badge variant={discrepancyMin > 0 ? "destructive" : "default"} className="text-xs">
                                {discrepancyMin > 0 ? '🔴' : '🟢'} {Math.abs(discrepancyMin)}min
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        
                        {employee.manualOverride && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/30 border-orange-300">
                                  ✋ Manual
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Ore setate manual de admin</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">@{employee.username}</div>
                      
                      {/* ✅ Total ore când e manual override */}
                      {employee.manualOverride && (
                        <div className="text-xs font-mono text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                          <span>📊</span>
                          <span>{employee.totalHours.toFixed(2).replace('.', ',')}h</span>
                        </div>
                      )}
                      
                      {isDrv && (
                        <Badge variant="secondary" className="w-fit text-xs">
                          🚗 Șofer
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* Clock In - cu editare inline */}
                  <TableCell>
                     {editingSegment && 
                     editingSegment.userId === employee.userId && 
                     editingSegment.field === 'startTime' &&
                     editingSegment.segmentIndex === 0 ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="time"
                          value={editingSegment.value}
                          onChange={(e) => onTimeChange(e.target.value)}
                          onBlur={(e) => {
                            const normalized = normalizeTimeInput(e.target.value);
                            onTimeChange(normalized);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onTimeSave(employee);
                            if (e.key === 'Escape') onTimeCancel();
                          }}
                          className="h-8 w-24"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => onTimeSave(employee)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={onTimeCancel}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (employee.manualOverride && !isAdmin) {
                                  return;
                                }
                                const firstSegment = employee.segments[0];
                                if (firstSegment && onClockInEdit) {
                                  onClockInEdit(employee);
                                }
                              }}
                              disabled={employee.manualOverride && !isAdmin}
                              className={`px-2 py-1 rounded text-sm font-mono hover:opacity-80 transition-opacity ${
                                (employee.manualOverride && !isAdmin) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              } ${clockInColor}`}
                            >
                              {clockInTime}
                              {!isDrv && clockInDiff && (
                                <span className="block text-xs">{clockInDiff}</span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {(employee.manualOverride && !isAdmin)
                              ? "⚠️ Ore setate manual — editează din dialog" 
                              : "Click pentru a modifica Clock In"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>

                  {/* Clock Out - cu editare inline */}
                  <TableCell>
                    {employee.lastClockOut ? (
                      editingSegment && 
                      editingSegment.userId === employee.userId && 
                      editingSegment.field === 'endTime' &&
                      editingSegment.segmentIndex === employee.segments.length - 1 ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="time"
                            value={editingSegment.value}
                            onChange={(e) => onTimeChange(e.target.value)}
                            onBlur={(e) => {
                              const normalized = normalizeTimeInput(e.target.value);
                              onTimeChange(normalized);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onTimeSave(employee);
                              if (e.key === 'Escape') onTimeCancel();
                            }}
                            className="h-8 w-24"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => onTimeSave(employee)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={onTimeCancel}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  if (employee.manualOverride && !isAdmin) {
                                    return;
                                  }
                                  const lastSegment = employee.segments[employee.segments.length - 1];
                                  if (lastSegment && onClockOutEdit) {
                                    onClockOutEdit(employee);
                                  }
                                }}
                                disabled={employee.manualOverride && !isAdmin}
                                className={`px-2 py-1 rounded text-sm font-mono hover:opacity-80 transition-opacity ${
                                  (employee.manualOverride && !isAdmin) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                } ${clockOutColor}`}
                              >
                                {clockOutTime}
                                {!isDrv && clockOutDiff && (
                                  <span className="block text-xs">{clockOutDiff}</span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(employee.manualOverride && !isAdmin)
                                ? "⚠️ Ore setate manual — editează din dialog" 
                                : "Click pentru a modifica Clock In/Out"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Lipsă Clock-Out
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              ⚠️ Clock-Out lipsește - folosește editare manuală
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground transition-colors">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="text-xs leading-relaxed">
                                ⚠️ <strong>Angajatul nu a dat clock-out.</strong><br />
                                Folosește butonul <strong>"✏️ Editare"</strong> din coloana <em>Actions</em> pentru a completa manual clock-out sau ajusta orele.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </TableCell>

                  {/* Fragmentare - Badge display cu butoane + pentru tipuri noi */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 max-w-2xl">
                      {/* ⚠️ WARNING BADGE pentru suprapunere ore */}
                      {(() => {
                        if (!employee.lastClockOut) return null;
                        
                        const durataBruta = (new Date(employee.lastClockOut).getTime() - new Date(employee.firstClockIn).getTime()) / (1000 * 60 * 60);
                        const segmentTypesManuale = ['hours_passenger', 'hours_driving', 'hours_equipment', 'hours_night', 'hours_saturday', 'hours_sunday', 'hours_holiday'];
                        const sumaManuale = segmentTypesManuale.reduce((sum, t) => sum + getDisplayHours(employee, t), 0);
                        const regular = getDisplayHours(employee, 'hours_regular');
                        const sumaTotal = sumaManuale + regular;
                        
                        if (sumaTotal > durataBruta + 0.05) {
                          const suprapunere = sumaTotal - durataBruta;
                          return (
                            <Badge variant="destructive" className="animate-pulse">
                              ⚠️ Suprapunere: {suprapunere.toFixed(2)}h
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                      {/* Afișăm TOATE tipurile de segmente */}
                      {['hours_regular', 'hours_night', 'hours_saturday', 'hours_sunday', 'hours_holiday', 'hours_passenger', 'hours_driving', 'hours_equipment'].map((segmentType) => {
                        const hours = getDisplayHours(employee, segmentType);
                        const icon = getSegmentIcon(segmentType);
                        const label = getSegmentLabel(segmentType);
                        
                        // Dacă este în editare pentru acest segment
                        if (editingHours && editingHours.userId === employee.userId && editingHours.segmentType === segmentType) {
                          return (
                            <div key={segmentType} className="flex items-center gap-1 p-2 bg-muted rounded-md border">
                              <span className="text-sm">{icon}</span>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="24"
                                value={editingHours.value}
                                onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveSegmentHours(employee.userId, editingHours.segmentType, parseFloat(editingHours.value));
                                  if (e.key === 'Escape') setEditingHours(null);
                                }}
                                className="h-7 w-16 text-xs"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleSaveSegmentHours(employee.userId, editingHours.segmentType, parseFloat(editingHours.value))}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setEditingHours(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        }
                        
                        // Dacă are ore > 0, arată badge clickable
                        if (hours > 0) {
                          return (
                            <SegmentBadge 
                              key={segmentType}
                              type={segmentType} 
                              hours={hours} 
                              icon={icon}
                              onClick={() => setEditingHours({ userId: employee.userId, segmentType: segmentType, value: hours.toFixed(1) })}
                            />
                          );
                        }
                        
                        // Dacă are ore === 0, arată buton "+"
                        return (
                          <Button
                            key={segmentType}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 opacity-60 hover:opacity-100 transition-opacity"
                            onClick={() => setEditingHours({ userId: employee.userId, segmentType: segmentType, value: '0.0' })}
                          >
                            <Plus className="h-3 w-3" />
                            <span className="text-sm">{icon}</span>
                            <span>{label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>

                  {/* Total Ore */}
                  <TableCell className="text-center font-medium">
                    <div className="flex items-center gap-1 justify-center">
                      <span>{employee.totalHours.toFixed(1)}h</span>
                      
                      {(() => {
                        const discrepancyMin = getHoursDiscrepancyMinutes(employee);
                        
                        // ✅ Ascunde badge dacă diferența ≤ 20 min
                        if (discrepancyMin !== null && discrepancyMin <= 20) {
                          return null;
                        }
                        
                        // ✅ Afișează badge doar dacă > 20 min SAU nu există Clock In/Out
                        if (employee.manualOverride) {
                          const rawDurationMs = employee.lastClockOut && employee.firstClockIn
                            ? new Date(employee.lastClockOut).getTime() - new Date(employee.firstClockIn).getTime()
                            : 0;
                          const rawDurationHours = rawDurationMs / (1000 * 60 * 60);
                          
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs px-1 bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700">
                                    ⚠️
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold">Segmentare Manuală</div>
                                    <div className="text-muted-foreground">
                                      Orele au fost ajustate manual.<br/>
                                      {discrepancyMin !== null && (
                                        <>
                                          Diferență: {discrepancyMin} min (toleranță: ±20 min)<br/>
                                          <span className="text-xs opacity-75">
                                            Clock brut: {rawDurationHours.toFixed(2)}h | Alocat: {employee.totalHours.toFixed(1)}h
                                          </span><br/>
                                        </>
                                      )}
                                      Pentru re-calcul automat, editează Clock In/Out direct în tabel.
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        
                        return null;
                      })()}
                    </div>
                  </TableCell>

                  {/* Status cu buton Aprobă */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!employee.allApproved ? (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => onApprove(employee.entries[0].id)}
                                  className="gap-1"
                                >
                                  <Check className="h-4 w-4" />
                                  Aprobă
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Aprobă pontajul acestui angajat</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => onDelete(employee.entries[0])}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Șterge pontaj</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aprobat
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
};
