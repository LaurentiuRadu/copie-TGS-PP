import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Check, X, CheckCircle2 } from 'lucide-react';
import { formatRomania } from '@/lib/timezone';
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

interface Segment {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  duration: number;
}

interface EmployeeDayData {
  userId: string;
  fullName: string;
  username: string;
  totalHours: number;
  firstClockIn: string;
  lastClockOut: string | null;
  segments: Segment[];
  entries: any[];
  allApproved: boolean;
  overrideHours?: {
    hours_regular: number;
    hours_driving: number;
    hours_passenger: number;
    hours_equipment: number;
    hours_night: number;
    hours_saturday: number;
    hours_sunday: number;
    hours_holiday: number;
  };
  manualOverride?: boolean;
}

interface TeamTimeComparisonTableProps {
  groupedByEmployee: EmployeeDayData[];
  onEdit: (entry: any) => void;
  onDelete: (entry: any) => void;
  onApprove: (entryId: string) => void;  // ✅ ADĂUGAT
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
}

export const TeamTimeComparisonTable = ({
  groupedByEmployee,
  onEdit,
  onDelete,
  onApprove,  // ✅ ADĂUGAT
  onUniformize,
  onTimeClick,
  editingSegment,
  onTimeChange,
  onTimeSave,
  onTimeCancel,
  onSegmentHoursEdit,
  onClockInEdit,
  onClockOutEdit,
}: TeamTimeComparisonTableProps) => {
  const [editingHours, setEditingHours] = useState<{
    userId: string;
    segmentType: string;
    value: string;
  } | null>(null);
  
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
    const nonDrivers = groupedByEmployee.filter(emp => !isDriver(emp.segments));
    
    if (nonDrivers.length === 0) {
      return { avgClockIn: null, avgClockOut: null, avgHours: 0 };
    }

    const clockIns = nonDrivers.map(emp => {
      const date = new Date(emp.firstClockIn);
      return date.getHours() * 60 + date.getMinutes();
    });

    const clockOuts = nonDrivers
      .filter(emp => emp.lastClockOut)
      .map(emp => {
        const date = new Date(emp.lastClockOut!);
        return date.getHours() * 60 + date.getMinutes();
      });

    const avgClockInMinutes = Math.round(clockIns.reduce((a, b) => a + b, 0) / clockIns.length);
    const avgClockOutMinutes = clockOuts.length > 0 
      ? Math.round(clockOuts.reduce((a, b) => a + b, 0) / clockOuts.length)
      : null;

    const avgClockIn = `${Math.floor(avgClockInMinutes / 60).toString().padStart(2, '0')}:${(avgClockInMinutes % 60).toString().padStart(2, '0')}`;
    const avgClockOut = avgClockOutMinutes 
      ? `${Math.floor(avgClockOutMinutes / 60).toString().padStart(2, '0')}:${(avgClockOutMinutes % 60).toString().padStart(2, '0')}`
      : null;

    const avgHours = nonDrivers.reduce((sum, emp) => sum + emp.totalHours, 0) / nonDrivers.length;

    return { avgClockIn, avgClockOut, avgHours };
  };

  const teamAverage = calculateTeamAverage();

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
    if (!avgTime) return '';
    
    const diff = getTimeDifferenceMinutes(time, avgTime);
    const [h1, m1] = time.split(':').map(Number);
    const [h2, m2] = avgTime.split(':').map(Number);
    
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    
    const sign = minutes1 >= minutes2 ? '+' : '-';
    return `${sign}${diff}min`;
  };

  const getSegmentIcon = (type: string) => {
    switch(type) {
      case 'hours_driving': return '🚗';
      case 'hours_passenger': return '👥';
      case 'hours_equipment': return '🚜';
      case 'hours_night': return '🌙';
      case 'hours_holiday': return '🎉';
      case 'hours_regular': return '⚙️';
      default: return '📋';
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
      default: return type;
    }
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

  // Handler pentru salvare ore segment
  const handleSaveSegmentHours = (userId: string, segmentType: string, newHours: number) => {
    onSegmentHoursEdit(userId, segmentType, newHours);
    setEditingHours(null);
  };

  return (
    <div className="space-y-4">
      {/* Header cu buton uniformizare */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Comparație Pontaje</h3>
          <p className="text-sm text-muted-foreground">
            Legenda: 🟢 ≤15min | 🟡 15-30min | 🔴 &gt;30min diferență
          </p>
        </div>
        {groupedByEmployee.some(emp => !isDriver(emp.segments)) && (
          <Button onClick={onUniformize} variant="secondary" size="sm">
            🔄 Uniformizează Orele
          </Button>
        )}
      </div>

      {/* Tabel orizontal */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Angajat</TableHead>
              <TableHead className="min-w-[120px]">Clock In</TableHead>
              <TableHead className="min-w-[120px]">Clock Out</TableHead>
              <TableHead className="min-w-[80px] text-xs">Zi</TableHead>
              <TableHead className="min-w-[80px] text-xs">Noapte</TableHead>
              <TableHead className="min-w-[70px] text-xs">Sâm</TableHead>
              <TableHead className="min-w-[70px] text-xs">Dum</TableHead>
              <TableHead className="min-w-[70px] text-xs">Sârb</TableHead>
              <TableHead className="min-w-[80px] text-xs">Pasager</TableHead>
              <TableHead className="min-w-[80px] text-xs">Condus</TableHead>
              <TableHead className="min-w-[80px] text-xs">Utilaj</TableHead>
              <TableHead className="min-w-[80px] text-xs">Pauză</TableHead>
              <TableHead className="min-w-[100px]">Total Ore</TableHead>
              <TableHead className="min-w-[150px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Rând media echipei */}
            {teamAverage.avgClockIn && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>
                  📊 Media Echipei
                  <div className="text-xs text-muted-foreground font-normal">
                    (exclude șoferii)
                  </div>
                </TableCell>
                <TableCell>{teamAverage.avgClockIn}</TableCell>
                <TableCell>{teamAverage.avgClockOut || '—'}</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell className="text-muted-foreground text-xs">—</TableCell>
                <TableCell>{teamAverage.avgHours.toFixed(2)}h</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
              </TableRow>
            )}

            {/* Rânduri angajați */}
            {groupedByEmployee.map((employee) => {
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
                                if (employee.manualOverride) {
                                  return;
                                }
                                const firstSegment = employee.segments[0];
                                if (firstSegment && onClockInEdit) {
                                  onClockInEdit(employee);
                                }
                              }}
                              disabled={employee.manualOverride}
                              className={`px-2 py-1 rounded text-sm font-mono hover:opacity-80 transition-opacity ${
                                employee.manualOverride ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              } ${clockInColor}`}
                            >
                              {clockInTime}
                              {!isDrv && clockInDiff && (
                                <span className="block text-xs">{clockInDiff}</span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {employee.manualOverride 
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
                                  if (employee.manualOverride) {
                                    return;
                                  }
                                  const lastSegment = employee.segments[employee.segments.length - 1];
                                  if (lastSegment && onClockOutEdit) {
                                    onClockOutEdit(employee);
                                  }
                                }}
                                disabled={employee.manualOverride}
                                className={`px-2 py-1 rounded text-sm font-mono hover:opacity-80 transition-opacity ${
                                  employee.manualOverride ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                } ${clockOutColor}`}
                              >
                                {clockOutTime}
                                {!isDrv && clockOutDiff && (
                                  <span className="block text-xs">{clockOutDiff}</span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {employee.manualOverride 
                                ? "⚠️ Ore setate manual — editează din dialog" 
                                : "Click pentru a modifica Clock Out"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Ore Zi - editabil */}
                  <TableCell>
                    {employee.manualOverride ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs font-mono cursor-default">
                              {getDisplayHours(employee, 'hours_regular').toFixed(1)}h
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ Ore setate manual — editează din dialog
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : editingHours && editingHours.userId === employee.userId && editingHours.segmentType === 'hours_regular' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          value={editingHours.value}
                          onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSegmentHours(employee.userId, 'hours_regular', parseFloat(editingHours.value));
                            if (e.key === 'Escape') setEditingHours(null);
                          }}
                          className="h-7 w-14 text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleSaveSegmentHours(employee.userId, 'hours_regular', parseFloat(editingHours.value))}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => setEditingHours(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingHours({ userId: employee.userId, segmentType: 'hours_regular', value: getDisplayHours(employee, 'hours_regular').toFixed(1) })}
                        className="px-2 py-1 rounded text-xs font-mono hover:bg-muted transition-colors"
                      >
                        {getDisplayHours(employee, 'hours_regular').toFixed(1)}h
                      </button>
                    )}
                  </TableCell>

                  {/* Ore Noapte */}
                  <TableCell>
                    <span className="text-xs font-mono">
                      {getDisplayHours(employee, 'hours_night').toFixed(1)}h
                    </span>
                  </TableCell>

                  {/* Ore Sâmbătă */}
                  <TableCell>
                    <span className="text-xs font-mono">
                      {getDisplayHours(employee, 'hours_saturday').toFixed(1)}h
                    </span>
                  </TableCell>

                  {/* Ore Duminică */}
                  <TableCell>
                    <span className="text-xs font-mono">
                      {getDisplayHours(employee, 'hours_sunday').toFixed(1)}h
                    </span>
                  </TableCell>

                  {/* Ore Sărbătoare */}
                  <TableCell>
                    <span className="text-xs font-mono">
                      {getDisplayHours(employee, 'hours_holiday').toFixed(1)}h
                    </span>
                  </TableCell>

                  {/* Ore Pasager - editabil */}
                  <TableCell>
                    {employee.manualOverride ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-mono cursor-default">
                              {getDisplayHours(employee, 'hours_driving').toFixed(1)}h
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ Ore setate manual — editează din dialog
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : editingHours && editingHours.userId === employee.userId && editingHours.segmentType === 'hours_driving' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          value={editingHours.value}
                          onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSegmentHours(employee.userId, 'hours_driving', parseFloat(editingHours.value));
                            if (e.key === 'Escape') setEditingHours(null);
                          }}
                          className="h-8 w-16"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleSaveSegmentHours(employee.userId, 'hours_driving', parseFloat(editingHours.value))}
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
                    ) : (
                      <button
                        onClick={() => setEditingHours({ userId: employee.userId, segmentType: 'hours_driving', value: getDisplayHours(employee, 'hours_driving').toFixed(1) })}
                        className="px-2 py-1 rounded text-sm font-mono hover:bg-muted transition-colors"
                      >
                        {getDisplayHours(employee, 'hours_driving').toFixed(1)}h
                      </button>
                    )}
                  </TableCell>

                  {/* Ore Pasager - editabil */}
                  <TableCell>
                    {employee.manualOverride ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs font-mono cursor-default">
                              {getDisplayHours(employee, 'hours_passenger').toFixed(1)}h
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ Ore setate manual — editează din dialog
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : editingHours && editingHours.userId === employee.userId && editingHours.segmentType === 'hours_passenger' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          value={editingHours.value}
                          onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSegmentHours(employee.userId, 'hours_passenger', parseFloat(editingHours.value));
                            if (e.key === 'Escape') setEditingHours(null);
                          }}
                          className="h-7 w-14 text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleSaveSegmentHours(employee.userId, 'hours_passenger', parseFloat(editingHours.value))}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => setEditingHours(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingHours({ userId: employee.userId, segmentType: 'hours_passenger', value: getDisplayHours(employee, 'hours_passenger').toFixed(1) })}
                        className="px-2 py-1 rounded text-xs font-mono hover:bg-muted transition-colors"
                      >
                        {getDisplayHours(employee, 'hours_passenger').toFixed(1)}h
                      </button>
                    )}
                  </TableCell>

                  {/* Ore Condus - editabil */}
                  <TableCell>
                    {employee.manualOverride ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs font-mono cursor-default">
                              {getDisplayHours(employee, 'hours_driving').toFixed(1)}h
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ Ore setate manual — editează din dialog
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : editingHours && editingHours.userId === employee.userId && editingHours.segmentType === 'hours_driving' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          value={editingHours.value}
                          onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSegmentHours(employee.userId, 'hours_driving', parseFloat(editingHours.value));
                            if (e.key === 'Escape') setEditingHours(null);
                          }}
                          className="h-7 w-14 text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleSaveSegmentHours(employee.userId, 'hours_driving', parseFloat(editingHours.value))}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => setEditingHours(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingHours({ userId: employee.userId, segmentType: 'hours_driving', value: getDisplayHours(employee, 'hours_driving').toFixed(1) })}
                        className="px-2 py-1 rounded text-xs font-mono hover:bg-muted transition-colors"
                      >
                        {getDisplayHours(employee, 'hours_driving').toFixed(1)}h
                      </button>
                    )}
                  </TableCell>

                  {/* Ore Utilaj - editabil */}
                  <TableCell>
                    {employee.manualOverride ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs font-mono cursor-default">
                              {getDisplayHours(employee, 'hours_equipment').toFixed(1)}h
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ Ore setate manual — editează din dialog
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : editingHours && editingHours.userId === employee.userId && editingHours.segmentType === 'hours_equipment' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          value={editingHours.value}
                          onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSegmentHours(employee.userId, 'hours_equipment', parseFloat(editingHours.value));
                            if (e.key === 'Escape') setEditingHours(null);
                          }}
                          className="h-7 w-14 text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleSaveSegmentHours(employee.userId, 'hours_equipment', parseFloat(editingHours.value))}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => setEditingHours(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingHours({ userId: employee.userId, segmentType: 'hours_equipment', value: getDisplayHours(employee, 'hours_equipment').toFixed(1) })}
                        className="px-2 py-1 rounded text-xs font-mono hover:bg-muted transition-colors"
                      >
                        {getDisplayHours(employee, 'hours_equipment').toFixed(1)}h
                      </button>
                    )}
                  </TableCell>

                  {/* Pauză - scăzută automat de edge function din ore normale */}
                  <TableCell>
                    {(() => {
                      if (!employee.lastClockOut) {
                        return <span className="text-sm text-muted-foreground">—</span>;
                      }
                      
                      // Folosim getDisplayHours pentru ore normale (respectă override-ul)
                      const normalHours = getDisplayHours(employee, 'hours_regular');
                      
                      // Regula: Pauza de 30 min (0.5h) se scade AUTOMAT din ore normale de către edge function
                      // NU se scade din ore Pasager/Condus/Utilaj
                      // Deci afișăm fix 0.5h dacă există ore normale >= 0.5h, 0h altfel
                      const breakHours = normalHours >= 0.5 ? 0.5 : 0;
                      
                      return breakHours > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-mono text-orange-600 dark:text-orange-400">
                                {breakHours.toFixed(2)}h
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div>Pauză standard: 30 min</div>
                                <div className="text-muted-foreground">
                                  Scăzută automat din ore normale
                                </div>
                                <div className="font-semibold mt-1 pt-1 border-t">
                                  {normalHours >= 0.5 ? '✅ Pauză aplicată' : '❌ Fără ore normale'}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      );
                    })()}
                  </TableCell>

                  {/* Total Ore */}
                  <TableCell className="font-mono font-semibold">
                    {employee.totalHours.toFixed(2)}h
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
                                  className="h-8 w-8"
                                  onClick={() => onEdit(employee.entries[0])}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editează pontaj</TooltipContent>
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
    </div>
  );
};
