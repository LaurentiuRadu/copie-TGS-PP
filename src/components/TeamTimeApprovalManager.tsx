import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertCircle, Calendar, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, Info, CheckCircle2, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatRomania } from '@/lib/timezone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { DeleteTimeEntryDialog } from '@/components/DeleteTimeEntryDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TeamTimeApprovalManagerProps {
  selectedWeek: string;
  selectedDayOfWeek: number;
  availableTeams: Set<string>;
  selectedTeam: string | null;
  editedTeams: Set<string>;
  onTeamEdited: (teamId: string) => void;
  onTeamChange: (teamId: string) => void;
}

export const TeamTimeApprovalManager = ({ 
  selectedWeek, 
  selectedDayOfWeek, 
  availableTeams,
  selectedTeam,
  editedTeams,
  onTeamEdited,
  onTeamChange
}: TeamTimeApprovalManagerProps) => {
  // Găsește următoarea echipă needitată
  const getNextUneditedTeam = (): string | null => {
    const sortedTeams = Array.from(availableTeams).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });
    
    return sortedTeams.find(team => !editedTeams.has(team)) || null;
  };

  const {
    pendingEntries,
    teamLeader,
    coordinator,
    teamMembers = [],
    teamStats,
    isLoading,
    detectDiscrepancies,
    approveMutation,
  } = useTeamApprovalWorkflow(selectedTeam, selectedWeek, selectedDayOfWeek);

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntryForApproval | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryForApproval | null>(null);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const [editingSegment, setEditingSegment] = useState<{
    userId: string;
    segmentIndex: number;
    field: 'duration';
    value: string;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleSchedule = (entryId: string) => {
    setExpandedSchedules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const isScheduleExpanded = (entryId: string) => expandedSchedules.has(entryId);

  const handleApprove = (entryId: string) => {
    setActionEntryId(entryId);
    setActionDialogOpen(true);
  };

  const handleEdit = (entry: TimeEntryForApproval) => {
    setEditEntry(entry);
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: TimeEntryForApproval) => {
    setDeleteEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!actionEntryId) return;

    try {
      await approveMutation.mutateAsync({ entryId: actionEntryId });
      setActionDialogOpen(false);
      setActionEntryId(null);
      
      // ✅ Marchează echipa ca editată, DAR NU schimba automat echipa
      if (selectedTeam) {
        onTeamEdited(selectedTeam);
        toast({
          title: '✅ Pontaj aprobat',
          description: 'Selectează manual următoarea echipă din dropdown.',
        });
      }
    } catch (error) {
      console.error('[Approval Error]', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600/20 text-red-900 dark:text-red-200 border-red-600/40 dark:bg-red-950/50 dark:border-red-700';
      case 'high':
        return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 dark:bg-red-950/30 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20 dark:bg-yellow-950/20 dark:border-yellow-800';
      default:
        return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 dark:bg-green-950/20 dark:border-green-800';
    }
  };

  // Filtrare pontaje invalide (< 10 min durata)
  const validPendingEntries = pendingEntries.filter(entry => {
    if (!entry.clock_in_time || !entry.clock_out_time) return false;
    const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
    return duration >= 0.17; // ✅ 10 min = 0.167h (rotunjit la 0.17 pentru siguranță)
  });

  const approvedEntries = validPendingEntries.filter(e => e.approval_status === 'approved');
  const pendingOnlyEntries = validPendingEntries.filter(e => e.approval_status === 'pending_review');
  const displayedEntries = [...pendingOnlyEntries, ...approvedEntries];

  // ✅ GRUPARE PE ANGAJAT: combinăm toate pontajele unui user într-o singură structură
  interface EmployeeDayData {
    userId: string;
    fullName: string;
    username: string;
    totalHours: number;
    firstClockIn: string;
    lastClockOut: string | null;
    segments: Array<{
      type: string;
      startTime: string;
      endTime: string;
      duration: number;
    }>;
    entries: TimeEntryForApproval[];
    allApproved: boolean;
  }

  const groupedByEmployee = useMemo(() => {
    const grouped = new Map<string, EmployeeDayData>();
    
    displayedEntries.forEach(entry => {
      const userId = entry.user_id;
      
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          fullName: entry.profiles.full_name,
          username: entry.profiles.username,
          totalHours: 0,
          firstClockIn: entry.clock_in_time,
          lastClockOut: entry.clock_out_time,
          segments: [],
          entries: [],
          allApproved: true,
        });
      }
      
      const employeeData = grouped.get(userId)!;
      employeeData.entries.push(entry);
      
      // Update first/last timestamps
      if (entry.clock_in_time < employeeData.firstClockIn) {
        employeeData.firstClockIn = entry.clock_in_time;
      }
      if (entry.clock_out_time && (!employeeData.lastClockOut || entry.clock_out_time > employeeData.lastClockOut)) {
        employeeData.lastClockOut = entry.clock_out_time;
      }
      
      // Check approval status
      if (entry.approval_status !== 'approved') {
        employeeData.allApproved = false;
      }
      
      // Adăugăm segmentele
      if (entry.segments && entry.segments.length > 0) {
        entry.segments.forEach(seg => {
          employeeData.segments.push({
            type: seg.segment_type,
            startTime: seg.start_time,
            endTime: seg.end_time,
            duration: seg.hours_decimal,
          });
          employeeData.totalHours += seg.hours_decimal;
        });
      }
    });
    
    // Sortăm segmentele cronologic
    grouped.forEach(emp => {
      emp.segments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      emp.totalHours = Math.round(emp.totalHours * 100) / 100;
    });
    
    return Array.from(grouped.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [displayedEntries]);

  // Helper pentru icon-uri segment
  const getSegmentIcon = (type: string) => {
    switch(type) {
      case 'hours_driving': return '🚗';
      case 'hours_passenger': return '🚙';
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

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
        body: { 
          mode: 'missing_segments',
          batch_size: 100
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      toast({
        title: '✅ Recalculare finalizată',
        description: `${data.success}/${data.total} pontaje procesate cu succes`,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '❌ Eroare recalculare',
        description: error.message,
      });
    },
  });

  const updateSegmentMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      workDate, 
      segmentType, 
      newValue 
    }: { 
      userId: string; 
      workDate: string; 
      segmentType: string; 
      newValue: number;
    }) => {
      // 1. Obține datele curente din daily_timesheets
      const { data: currentTimesheet, error: fetchError } = await supabase
        .from('daily_timesheets')
        .select('*')
        .eq('employee_id', userId)
        .eq('work_date', workDate)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // 2. Creează obiect actualizat
      const updatedData = {
        employee_id: userId,
        work_date: workDate,
        hours_regular: currentTimesheet?.hours_regular || 0,
        hours_night: currentTimesheet?.hours_night || 0,
        hours_saturday: currentTimesheet?.hours_saturday || 0,
        hours_sunday: currentTimesheet?.hours_sunday || 0,
        hours_holiday: currentTimesheet?.hours_holiday || 0,
        hours_passenger: currentTimesheet?.hours_passenger || 0,
        hours_driving: currentTimesheet?.hours_driving || 0,
        hours_equipment: currentTimesheet?.hours_equipment || 0,
        hours_leave: currentTimesheet?.hours_leave || 0,
        hours_medical_leave: currentTimesheet?.hours_medical_leave || 0,
        notes: `[EDITARE INLINE SEGMENT] Actualizat ${segmentType} la ${newValue.toFixed(2)}h`,
      };

      // 3. Actualizează doar câmpul editat
      (updatedData as any)[segmentType] = newValue;

      // 4. Upsert în daily_timesheets
      const { error: upsertError } = await supabase
        .from('daily_timesheets')
        .upsert(updatedData, { onConflict: 'employee_id,work_date' });

      if (upsertError) throw upsertError;

      return { userId, workDate, segmentType, newValue };
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Segment actualizat',
        description: `Durata ${getSegmentLabel(data.segmentType)} actualizată la ${data.newValue.toFixed(2)}h`,
      });
      
      // Invalidează cache-ul pentru a reîncărca datele
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTimesheets'] });
      
      // Resetează editing state
      setEditingSegment(null);
    },
    onError: (error: any) => {
      toast({
        title: '❌ Eroare la actualizare',
        description: error.message || 'Nu s-a putut actualiza segmentul',
        variant: 'destructive',
      });
      setEditingSegment(null);
    },
  });

  const handleSegmentClick = (userId: string, segmentIndex: number, currentValue: number) => {
    setEditingSegment({
      userId,
      segmentIndex,
      field: 'duration',
      value: currentValue.toFixed(2),
    });
  };

  const handleSegmentChange = (newValue: string) => {
    if (!editingSegment) return;
    setEditingSegment({ ...editingSegment, value: newValue });
  };

  const handleSegmentSave = (employee: EmployeeDayData) => {
    if (!editingSegment) return;

    const segment = employee.segments[editingSegment.segmentIndex];
    const newValue = parseFloat(editingSegment.value);

    // Validare
    if (isNaN(newValue) || newValue < 0 || newValue > 24) {
      toast({
        title: '⚠️ Valoare invalidă',
        description: 'Durata trebuie să fie între 0 și 24 ore',
        variant: 'destructive',
      });
      setEditingSegment(null);
      return;
    }

    // Extrage work_date din startTime al segmentului
    const workDate = format(new Date(segment.startTime), 'yyyy-MM-dd');

    // Apelează mutation-ul
    updateSegmentMutation.mutate({
      userId: employee.userId,
      workDate,
      segmentType: segment.type,
      newValue,
    });
  };

  const handleSegmentCancel = () => {
    setEditingSegment(null);
  };

  if (availableTeams.size === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Nu există echipe programate în această săptămână
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedTeam) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Selectați o echipă pentru a vedea pontajele în așteptare
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aprobare Pontaje</CardTitle>
              <CardDescription>
                Săptămâna {format(new Date(selectedWeek), 'dd MMM yyyy', { locale: ro })}
              </CardDescription>
            </div>
            
            <Button
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              {reprocessMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalculează Segmente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              💡 Fiecare pontaj poate fi editat, aprobat sau șters individual.
            </AlertDescription>
          </Alert>

          {coordinator && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-purple-600">
                  Coordonator
                </Badge>
                <span className="font-medium">{coordinator.full_name}</span>
                <Badge variant="outline" className="text-xs">
                  {coordinator.username}
                </Badge>
              </div>
            </div>
          )}

          {(teamLeader || teamMembers.length > 0) && (
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                {teamLeader && (
                  <div className="flex items-center gap-2 pb-2">
                    <Badge variant="default" className="bg-blue-600">
                      Șef Echipă
                    </Badge>
                    <span className="font-medium">{teamLeader.full_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {teamLeader.username}
                    </Badge>
                  </div>
                )}
                
                {teamMembers
                  .filter(m => m.id !== teamLeader?.id)
                  .map(member => (
                    <div key={member.id} className="flex items-center gap-2 text-sm">
                      <span>{member.full_name}</span>
                      <Badge variant="outline" className="text-xs opacity-60">
                        {member.username}
                      </Badge>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {validPendingEntries.length > 0 && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Total pontaje valide</p>
                  <p className="text-2xl font-bold">{validPendingEntries.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">În așteptare</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingOnlyEntries.length}</p>
                </div>
                {approvedEntries.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Deja aprobate</p>
                    <p className="text-2xl font-bold text-green-600">{approvedEntries.length}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {groupedByEmployee.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium">Nu există pontaje</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByEmployee.map((employee) => (
                <Card key={employee.userId} className={employee.allApproved ? 'bg-green-50/30 dark:bg-green-950/10 border-green-200' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          👤 {employee.fullName}
                          <Badge variant="outline">{employee.username}</Badge>
                          {employee.allApproved && (
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Aprobat
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Total: <span className="font-bold text-lg">{employee.totalHours.toFixed(2)}h</span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Segmente de timp */}
                    {employee.segments.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        {employee.segments.map((segment, idx) => {
                          const isEditing = editingSegment?.userId === employee.userId && 
                                            editingSegment?.segmentIndex === idx;
                          
                          return (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                              <span className="text-2xl">{getSegmentIcon(segment.type)}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{getSegmentLabel(segment.type)}</span>
                                  
                                  {/* ✅ INLINE EDITING PENTRU DURATĂ */}
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="24"
                                        value={editingSegment.value}
                                        onChange={(e) => handleSegmentChange(e.target.value)}
                                        onBlur={() => handleSegmentSave(employee)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSegmentSave(employee);
                                          if (e.key === 'Escape') handleSegmentCancel();
                                        }}
                                        autoFocus
                                        className="w-20 h-7 text-xs"
                                      />
                                      <span className="text-xs text-muted-foreground">h</span>
                                    </div>
                                  ) : (
                                    <Badge 
                                      variant="secondary" 
                                      className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                                      onClick={() => handleSegmentClick(employee.userId, idx, segment.duration)}
                                      title="Click pentru a edita durata"
                                    >
                                      {segment.duration.toFixed(2)}h
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {formatRomania(segment.startTime, 'HH:mm')} → {formatRomania(segment.endTime, 'HH:mm')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          ⚠️ Segmente lipsă - folosește butonul "Recalculează Segmente"
                        </p>
                      </div>
                    )}
                    
                    {/* Clock in/out total */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md mb-4">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Clock In: <span className="font-medium">{formatRomania(employee.firstClockIn, 'HH:mm')}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Clock Out: <span className="font-medium">{employee.lastClockOut ? formatRomania(employee.lastClockOut, 'HH:mm') : '-'}</span></span>
                      </div>
                    </div>
                    
                    {/* Butoane acțiuni */}
                    {!employee.allApproved && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => {
                            employee.entries.forEach(entry => {
                              if (entry.approval_status !== 'approved') {
                                handleApprove(entry.id);
                              }
                            });
                          }}
                          className="gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Aprobă Toate
                        </Button>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(employee.entries[0])}
                              className="gap-1"
                            >
                              <Pencil className="h-4 w-4" />
                              Editează
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editează pontajul complet al zilei</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✅ Aprobă pontaj</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmați aprobarea acestui pontaj?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApproval}>
              Aprobă
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editEntry && (
        <TimeEntryApprovalEditDialog
          entry={editEntry}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditEntry(null);
          }}
          onSuccess={() => {
            // Auto-scroll la următoarea echipă needitată după editare
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              
              const nextTeam = getNextUneditedTeam();
              if (nextTeam) {
                onTeamChange(nextTeam);
                toast({
                  title: '✅ Pontaj editat și aprobat',
                  description: `Trecem automat la echipa ${nextTeam}`,
                });
              } else {
                toast({
                  title: '🎉 Toate echipele verificate!',
                  description: 'Poți schimba ziua acum sau continua editarea.',
                });
                // NU schimbăm ziua automat - user decide manual
              }
            }
          }}
        />
      )}

      {deleteEntry && (
        <DeleteTimeEntryDialog
          entry={deleteEntry}
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteEntry(null);
          }}
          onSuccess={() => {
            // Reîmprospătare automată + navigare la următoarea echipă
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              
              const nextTeam = getNextUneditedTeam();
              if (nextTeam) {
                onTeamChange(nextTeam);
                toast({
                  title: '🗑️ Pontaj șters',
                  description: `Trecem automat la echipa ${nextTeam}`,
                });
              } else {
                toast({
                  title: '🗑️ Pontaj șters',
                  description: 'Toate echipele au fost verificate.',
                });
              }
            }
            
            // Reîmprospătare forțată a query-urilor locale
            queryClient.invalidateQueries({ 
              queryKey: ['team-pending-approvals', selectedTeam, selectedWeek, selectedDayOfWeek] 
            });
          }}
        />
      )}
    </>
  );
};

