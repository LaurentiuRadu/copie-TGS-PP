import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Check, X, ChevronDown } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EmployeePunchList } from './EmployeePunchList';
import { cn } from '@/lib/utils';

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
  realEntries?: any[]; // ✅ Entry-uri REALE pentru editare
  allApproved: boolean;
}

interface TeamTimeComparisonTableProps {
  groupedByEmployee: EmployeeDayData[];
  onEdit: (entry: any) => void;
  onDelete: (entry: any) => void;
  onUniformize: () => void;
  onBulkClockEdit: () => void;
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
}

export const TeamTimeComparisonTable = ({
  groupedByEmployee,
  onEdit,
  onDelete,
  onUniformize,
  onBulkClockEdit,
  onTimeClick,
  editingSegment,
  onTimeChange,
  onTimeSave,
  onTimeCancel,
}: TeamTimeComparisonTableProps) => {
  // State pentru rânduri expandabile
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (userId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };
  
  // Detectează șoferii (cei care conduc efectiv)
  const isDriver = (segments: Segment[]) => {
    return segments.some(s => s.type === 'hours_driving' || s.type === 'hours_equipment');
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
        <div className="flex gap-2">
          {groupedByEmployee.some(emp => !isDriver(emp.segments)) && (
            <Button onClick={onUniformize} variant="secondary" size="sm">
              🔄 Uniformizează Orele
            </Button>
          )}
          <Button onClick={onBulkClockEdit} variant="outline" size="sm">
            🕐 Editează Clock In/Out
          </Button>
        </div>
      </div>

      {/* Tabel orizontal */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Angajat</TableHead>
              <TableHead className="min-w-[120px]">Clock In</TableHead>
              <TableHead className="min-w-[120px]">Clock Out</TableHead>
              <TableHead className="min-w-[100px]">Total Ore</TableHead>
              <TableHead className="min-w-[200px]">Segmente</TableHead>
              <TableHead className="min-w-[100px] text-right">Acțiuni</TableHead>
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
                <TableCell>{teamAverage.avgHours.toFixed(2)}h</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
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
              
              const isExpanded = expandedRows.has(employee.userId);

              return (
                <Collapsible
                  key={employee.userId}
                  open={isExpanded}
                  onOpenChange={() => toggleRow(employee.userId)}
                >
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ChevronDown 
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>
                        
                        <div className="flex flex-col gap-1">
                          <div className="font-medium">{employee.fullName}</div>
                          <div className="text-xs text-muted-foreground">@{employee.username}</div>
                          {isDrv && (
                            <Badge variant="secondary" className="w-fit text-xs">
                              🚗 Șofer
                            </Badge>
                          )}
                        </div>
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
                            {(() => {
                              const firstSegment = employee.segments[0];
                              const isSynthetic = firstSegment?.id.startsWith('synthetic-');
                              return (
                                <button
                                  onClick={() => {
                                    if (firstSegment) {
                                      onTimeClick(employee.userId, 0, firstSegment.id, 'startTime', firstSegment.startTime);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded text-sm font-mono hover:opacity-80 transition-opacity ${clockInColor}`}
                                >
                                  {clockInTime}
                                  {!isDrv && clockInDiff && (
                                    <span className="block text-xs">{clockInDiff}</span>
                                  )}
                                </button>
                              );
                            })()}
                          </TooltipTrigger>
                          <TooltipContent>
                            {employee.segments[0]?.id.startsWith('synthetic-') 
                              ? 'Click pentru a edita pontajul real'
                              : 'Click pentru editare inline'
                            }
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
                              {(() => {
                                const lastSegment = employee.segments[employee.segments.length - 1];
                                const isSynthetic = lastSegment?.id.startsWith('synthetic-');
                                return (
                                  <button
                                    onClick={() => {
                                      if (lastSegment) {
                                        onTimeClick(employee.userId, employee.segments.length - 1, lastSegment.id, 'endTime', lastSegment.endTime);
                                      }
                                    }}
                                    className={`px-2 py-1 rounded text-sm font-mono hover:opacity-80 transition-opacity ${clockOutColor}`}
                                  >
                                    {clockOutTime}
                                    {!isDrv && clockOutDiff && (
                                      <span className="block text-xs">{clockOutDiff}</span>
                                    )}
                                  </button>
                                );
                              })()}
                            </TooltipTrigger>
                            <TooltipContent>
                              {employee.segments[employee.segments.length - 1]?.id.startsWith('synthetic-')
                                ? 'Click pentru a edita pontajul real'
                                : 'Click pentru editare inline'
                              }
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Total Ore */}
                  <TableCell className="font-mono">
                    {employee.totalHours.toFixed(2)}h
                  </TableCell>

                  {/* Segmente */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {employee.segments.map((segment, idx) => (
                        <TooltipProvider key={segment.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs">
                                {getSegmentIcon(segment.type)} {segment.duration.toFixed(1)}h
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {getSegmentLabel(segment.type)}
                              <br />
                              {formatRomania(segment.startTime, 'HH:mm')} - {formatRomania(segment.endTime, 'HH:mm')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </TableCell>

                  {/* Acțiuni */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                // ✅ Folosim REAL entry, nu synthetic segment
                                const entryToEdit = employee.realEntries?.[0] || employee.entries[0];
                                onEdit(entryToEdit);
                              }}
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
                              onClick={() => {
                                // ✅ Folosim REAL entry, nu synthetic segment
                                const entryToDelete = employee.realEntries?.[0] || employee.entries[0];
                                onDelete(entryToDelete);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Șterge pontaj</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
                
                {/* ✅ Rând expandabil cu lista de pontaje cronologice */}
                <CollapsibleContent asChild>
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <div className="px-6 py-3 border-l-2 border-primary/20">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          📋 Pontaje cronologice
                        </h4>
                        <EmployeePunchList entries={employee.entries} />
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
