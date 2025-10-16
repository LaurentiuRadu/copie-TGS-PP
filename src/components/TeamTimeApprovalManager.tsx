import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertCircle, Calendar, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, Info, CheckCircle2, RefreshCw, Trash2, RotateCcw, Table as TableIcon, List, X } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatRomania } from '@/lib/timezone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { DeleteTimeEntryDialog } from '@/components/DeleteTimeEntryDialog';
import { TeamTimeComparisonTable } from '@/components/TeamTimeComparisonTable';
import { UniformizeDialog } from '@/components/UniformizeDialog';
import { TeamEditScopeDialog } from '@/components/TeamEditScopeDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDailyTimesheets, type DailyTimesheet } from '@/hooks/useDailyTimesheets';
// ✅ Tabs import eliminat
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
    segmentId: string;
    field: 'startTime' | 'endTime';
    value: string;
  } | null>(null);
  
  const [editingManagementHours, setEditingManagementHours] = useState<{
    userId: string | null;
    segmentType: string | null;
    value: string;
  }>({
    userId: null,
    segmentType: null,
    value: '',
  });
  // ✅ View mode eliminat - folosim doar tabel
  const [uniformizeDialogOpen, setUniformizeDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    fieldName: 'Clock In' | 'Clock Out';
    employee: EmployeeDayData;
    currentValue: string;
    newValue: string;
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

  // Filtrare pontaje invalide (< 10 min durata) ȘI exclude coordonatori și team leaders din tabelul principal
  const validPendingEntries = pendingEntries.filter(entry => {
    if (!entry.clock_in_time || !entry.clock_out_time) return false;
    const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
    
    // ✅ Exclude coordonatori și team leaders din tabelul principal
    const isManagement = entry.user_id === teamLeader?.id || entry.user_id === coordinator?.id;
    
    return duration >= 0.17 && !isManagement;
  });

  // ✅ Pontaje pentru management (șef echipă + coordonator) - secțiune separată
  const managementEntries = pendingEntries.filter(entry => {
    if (!entry.clock_in_time || !entry.clock_out_time) return false;
    const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
    const isManagement = entry.user_id === teamLeader?.id || entry.user_id === coordinator?.id;
    return duration >= 0.17 && isManagement;
  });

  const approvedEntries = validPendingEntries.filter(e => e.approval_status === 'approved');
  const pendingOnlyEntries = validPendingEntries.filter(e => e.approval_status === 'pending_review');
  const displayedEntries = [...pendingOnlyEntries, ...approvedEntries];

  // Calculăm data exactă a zilei pentru a prelua daily_timesheets
  const dayDate = useMemo(() => {
    const weekStartDate = new Date(selectedWeek);
    weekStartDate.setDate(weekStartDate.getDate() + (selectedDayOfWeek - 1));
    return weekStartDate;
  }, [selectedWeek, selectedDayOfWeek]);

  // Preluăm daily_timesheets pentru ziua selectată
  const { data: dailyTimesheets = [] } = useDailyTimesheets(dayDate);

  // Construim map pentru override-uri manuale
  const overrideByUser = useMemo(() => {
    const map = new Map<string, DailyTimesheet>();
    dailyTimesheets.forEach(dt => {
      map.set(dt.employee_id, dt);
    });
    return map;
  }, [dailyTimesheets]);

  // ✅ GRUPARE MANAGEMENT PE UTILIZATOR: agregăm și aplicăm override-uri
  const standardTypes = ['hours_regular', 'hours_night', 'hours_saturday', 'hours_sunday', 'hours_holiday', 'hours_passenger', 'hours_driving', 'hours_equipment'] as const;
  type SegmentType = typeof standardTypes[number];

  const managementGroupedByUser = useMemo(() => {
    const byUser = new Map<string, {
      userId: string;
      fullName: string;
      username: string;
      aggregated: Record<SegmentType, number>;
      firstClockIn: string;
      lastClockOut: string | null;
      totalHours: number;
      manualOverride?: boolean;
      overrideHours?: Record<SegmentType, number>;
      approvalStatus: 'pending_review' | 'approved';
    }>();

    for (const entry of managementEntries) {
      const uid = entry.user_id;
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          userId: uid,
          fullName: entry.profiles.full_name,
          username: entry.profiles.username,
          aggregated: {
            hours_regular: 0, hours_night: 0, hours_saturday: 0, hours_sunday: 0, hours_holiday: 0,
            hours_passenger: 0, hours_driving: 0, hours_equipment: 0
          },
          firstClockIn: entry.clock_in_time,
          lastClockOut: entry.clock_out_time,
          totalHours: 0,
          approvalStatus: entry.approval_status as 'pending_review' | 'approved',
        });
      }
      const user = byUser.get(uid)!;

      // Update first/last timestamps
      if (entry.clock_in_time < user.firstClockIn) user.firstClockIn = entry.clock_in_time;
      if (entry.clock_out_time && (!user.lastClockOut || entry.clock_out_time > user.lastClockOut)) {
        user.lastClockOut = entry.clock_out_time;
      }

      // Agregăm segmentele din intrări
      if (entry.segments?.length) {
        for (const s of entry.segments) {
          const t = s.segment_type as SegmentType;
          if (standardTypes.includes(t)) {
            user.aggregated[t] += s.hours_decimal || 0;
            user.totalHours += s.hours_decimal || 0;
          }
        }
      }

      // Păstrează cel mai restrictiv status (dacă oricare e pending, marchez pending)
      if (user.approvalStatus !== 'approved') {
        user.approvalStatus = entry.approval_status as 'pending_review' | 'approved';
      }
    }

    // Aplicăm override-uri manuale din daily_timesheets
    byUser.forEach((user, uid) => {
      const override = overrideByUser.get(uid);
      if (override) {
        const hasManualOverride = override.notes?.includes('[SEGMENTARE MANUALĂ]')
          || override.notes?.includes('[OVERRIDE MANUAL')
          || managementEntries.some(e => e.user_id === uid && e.was_edited_by_admin);

        if (hasManualOverride) {
          user.manualOverride = true;
          user.overrideHours = {
            hours_regular: override.hours_regular || 0,
            hours_night: override.hours_night || 0,
            hours_saturday: override.hours_saturday || 0,
            hours_sunday: override.hours_sunday || 0,
            hours_holiday: override.hours_holiday || 0,
            hours_passenger: override.hours_passenger || 0,
            hours_driving: override.hours_driving || 0,
            hours_equipment: override.hours_equipment || 0,
          };
          user.totalHours = standardTypes.reduce((s, t) => s + (user.overrideHours![t] || 0), 0);
          user.totalHours = Math.round(user.totalHours * 100) / 100;
        } else {
          user.totalHours = Math.round(user.totalHours * 100) / 100;
        }
      } else {
        user.totalHours = Math.round(user.totalHours * 100) / 100;
      }
    });

    return Array.from(byUser.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [managementEntries, overrideByUser]);

  // ✅ GRUPARE PE ANGAJAT: combinăm toate pontajele unui user într-o singură structură
  interface EmployeeDayData {
    userId: string;
    fullName: string;
    username: string;
    totalHours: number;
    firstClockIn: string;
    lastClockOut: string | null;
    segments: Array<{
      id: string;
      type: string;
      startTime: string;
      endTime: string;
      duration: number;
    }>;
    entries: TimeEntryForApproval[];
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
            id: seg.id,
            type: seg.segment_type,
            startTime: seg.start_time,
            endTime: seg.end_time,
            duration: seg.hours_decimal,
          });
          employeeData.totalHours += seg.hours_decimal;
        });
      }
    });
    
    // Aplicăm override-uri manuale din daily_timesheets
    grouped.forEach((emp, userId) => {
      const override = overrideByUser.get(userId);
      
      if (override) {
        // Detectăm override manual dacă notes conține "[SEGMENTARE MANUALĂ]" sau "[OVERRIDE MANUAL"
        const hasManualOverride = override.notes?.includes('[SEGMENTARE MANUALĂ]') || 
                                 override.notes?.includes('[OVERRIDE MANUAL') ||
                                 emp.entries.some(e => e.was_edited_by_admin);
        
        if (hasManualOverride) {
          emp.overrideHours = {
            hours_regular: override.hours_regular || 0,
            hours_driving: override.hours_driving || 0,
            hours_passenger: override.hours_passenger || 0,
            hours_equipment: override.hours_equipment || 0,
            hours_night: override.hours_night || 0,
            hours_saturday: override.hours_saturday || 0,
            hours_sunday: override.hours_sunday || 0,
            hours_holiday: override.hours_holiday || 0,
          };
          emp.manualOverride = true;
          
          // Recalculăm totalHours din override
          emp.totalHours = Object.values(emp.overrideHours).reduce((sum, val) => sum + val, 0);
          emp.totalHours = Math.round(emp.totalHours * 100) / 100;
        }
      }
    });
    
    // Sortăm segmentele cronologic
    grouped.forEach(emp => {
      emp.segments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      if (!emp.manualOverride) {
        emp.totalHours = Math.round(emp.totalHours * 100) / 100;
      }
    });
    
    // Sortare după discrepanța Clock In față de media echipei
    const nonDriversNonCoords = Array.from(grouped.values()).filter(emp => {
      const hasDriverSegments = emp.segments.some(
        s => s.type === 'hours_driving' || s.type === 'hours_equipment'
      );
      const isCoordinator = emp.entries.some(e => 
        e.user_id === teamLeader?.id || e.user_id === coordinator?.id
      );
      return !hasDriverSegments && !isCoordinator;
    });
    
    if (nonDriversNonCoords.length === 0) {
      return Array.from(grouped.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    
    // Calculează media Clock In echipei (în minute de la miezul nopții)
    const avgClockInMinutes = nonDriversNonCoords.reduce((sum, emp) => {
      const clockIn = new Date(emp.firstClockIn);
      return sum + clockIn.getHours() * 60 + clockIn.getMinutes();
    }, 0) / nonDriversNonCoords.length;
    
    // Sortare: cel mai mare decalaj PRIMII, apoi alfabetic
    return Array.from(grouped.values()).sort((a, b) => {
      const getDiscrepancy = (emp: EmployeeDayData) => {
        const clockIn = new Date(emp.firstClockIn);
        const empMinutes = clockIn.getHours() * 60 + clockIn.getMinutes();
        return Math.abs(empMinutes - avgClockInMinutes);
      };
      
      const discrepancyA = getDiscrepancy(a);
      const discrepancyB = getDiscrepancy(b);
      
      if (discrepancyA !== discrepancyB) {
        return discrepancyB - discrepancyA;
      }
      
      return a.fullName.localeCompare(b.fullName);
    });
  }, [displayedEntries, overrideByUser]);

  // Helper pentru icon-uri segment
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
      case 'hours_saturday': return 'Sâm';
      case 'hours_sunday': return 'Dum';
      default: return type;
    }
  };

  // Helper pentru afișare ore management (cu override)
  const getDisplayHoursMgmt = (user: typeof managementGroupedByUser[number], type: SegmentType) => {
    if (user.manualOverride && user.overrideHours) {
      return user.overrideHours[type] || 0;
    }
    return user.aggregated[type] || 0;
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

  const updateSegmentTimeMutation = useMutation({
    mutationFn: async ({ 
      segmentId,
      field,
      newTime,
      currentSegment
    }: { 
      segmentId: string;
      field: 'startTime' | 'endTime';
      newTime: string;
      currentSegment: any;
    }) => {
      console.log('[Update Segment] Start:', { segmentId, field, newTime });
      
      // Validare segment ID
      if (!segmentId) {
        throw new Error('ID segment lipsește');
      }
      
      // Parse new time (format: HH:mm)
      const [hours, minutes] = newTime.split(':').map(Number);
      
      // Get date from existing timestamp
      const existingDate = new Date(field === 'startTime' ? currentSegment.startTime : currentSegment.endTime);
      const newDate = new Date(existingDate);
      newDate.setHours(hours, minutes, 0, 0);
      
      console.log('[Update Segment] New Date:', newDate.toISOString());
      
      // Calculate new duration
      const startTime = field === 'startTime' ? newDate : new Date(currentSegment.startTime);
      const endTime = field === 'endTime' ? newDate : new Date(currentSegment.endTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      
      console.log('[Update Segment] New Duration:', durationHours.toFixed(2), 'hours');
      
      if (durationHours <= 0 || durationHours > 24) {
        throw new Error(`Durata trebuie să fie între 0 și 24 ore (calculat: ${durationHours.toFixed(2)}h)`);
      }
      
      // Update segment in time_entry_segments
      const updateData = field === 'startTime' 
        ? { start_time: newDate.toISOString(), hours_decimal: durationHours }
        : { end_time: newDate.toISOString(), hours_decimal: durationHours };
      
      console.log('[Update Segment] Update Data:', updateData);
      
      const { data: updatedSegment, error: updateError } = await supabase
        .from('time_entry_segments')
        .update(updateData)
        .eq('id', segmentId)
        .select();
      
      if (updateError) {
        console.error('[Update Segment] Error:', updateError);
        throw updateError;
      }
      
      console.log('[Update Segment] Success:', updatedSegment);
      
      return { segmentId, field, newTime, durationHours };
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Timp actualizat',
        description: `Nou interval: ${data.durationHours.toFixed(2)}h`,
      });
      
      // Invalidează cache-ul pentru a reîncărca datele
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTimesheets'] });
      
      // Resetează editing state
      setEditingSegment(null);
    },
    onError: (error: any) => {
      console.error('[Update Segment] Mutation Error:', error);
      toast({
        title: '❌ Eroare la actualizare',
        description: error.message || 'Nu s-a putut actualiza timpul',
        variant: 'destructive',
      });
      setEditingSegment(null);
    },
  });

  const handleTimeClick = (userId: string, segmentIndex: number, segmentId: string, field: 'startTime' | 'endTime', currentTime: string) => {
    // ✅ VALIDARE: Siguranță runtime (deși tipul garantează că e definit)
    if (!segmentId) {
      console.error('[handleTimeClick] Segment ID is undefined');
      toast({
        title: '⚠️ Segment invalid',
        description: 'Acest segment nu poate fi editat. Încearcă să recalculezi segmentele.',
        variant: 'destructive',
      });
      return;
    }
    
    // Extract HH:mm from ISO timestamp
    const timeOnly = formatRomania(currentTime, 'HH:mm');
    setEditingSegment({
      userId,
      segmentIndex,
      segmentId,
      field,
      value: timeOnly,
    });
  };

  const handleTimeChange = (newValue: string) => {
    if (!editingSegment) return;
    setEditingSegment({ ...editingSegment, value: newValue });
  };

  const handleTimeSave = (employee: EmployeeDayData) => {
    if (!editingSegment) return;

    const segment = employee.segments[editingSegment.segmentIndex];
    
    // Validare format HH:mm
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(editingSegment.value)) {
      toast({
        title: '⚠️ Format invalid',
        description: 'Folosește formatul HH:mm (ex: 10:30)',
        variant: 'destructive',
      });
      setEditingSegment(null);
      return;
    }

    // Apelează mutation-ul
    updateSegmentTimeMutation.mutate({
      segmentId: editingSegment.segmentId,
      field: editingSegment.field,
      newTime: editingSegment.value,
      currentSegment: segment,
    });
  };

  const handleTimeCancel = () => {
    setEditingSegment(null);
  };

  const handleSaveManagementSegmentHours = async (
    userId: string,
    segmentType: string,
    newValue: number
  ) => {
    try {
      // Găsește work_date din managementEntries
      const userEntry = managementEntries.find(e => e.user_id === userId);
      if (!userEntry) {
        toast({
          title: "Nu s-a găsit pontajul pentru utilizator",
          variant: "destructive",
        });
        return;
      }
      
      // ✅ VALIDARE 1: Verifică Clock Out
      const clockIn = new Date(userEntry.clock_in_time);
      const clockOut = userEntry.clock_out_time ? new Date(userEntry.clock_out_time) : null;

      if (!clockOut) {
        toast({
          title: "⚠️ Pontaj incomplet",
          description: "Nu se poate edita - lipsește Clock Out",
          variant: "destructive",
        });
        return;
      }

      const totalAvailableHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      
      // ✅ VALIDARE 2: Calculează totalul segmentelor DUPĂ editare
      const currentUser = managementGroupedByUser.find(u => u.userId === userId);
      if (!currentUser) {
        toast({
          title: "Nu s-a găsit utilizatorul",
          variant: "destructive",
        });
        return;
      }

      let totalSegmentHours = 0;
      standardTypes.forEach(type => {
        if (type === segmentType) {
          totalSegmentHours += newValue; // Noua valoare
        } else {
          totalSegmentHours += getDisplayHoursMgmt(currentUser, type); // Valorile existente
        }
      });

      // ✅ VALIDARE 3: Verifică dacă totalul depășește timpul disponibil
      if (totalSegmentHours > totalAvailableHours + 0.05) { // +3 minute toleranță
        toast({
          title: "❌ Eroare: Total segmente depășește Clock In/Out",
          description: `Total segmente (${totalSegmentHours.toFixed(1)}h) depășește diferența Clock In/Out (${totalAvailableHours.toFixed(1)}h)`,
          variant: "destructive",
        });
        return;
      }
      
      const workDate = format(new Date(userEntry.clock_in_time), 'yyyy-MM-dd');
      
      // Verifică dacă există deja daily_timesheet
      const { data: existingTimesheet } = await supabase
        .from('daily_timesheets')
        .select('*')
        .eq('employee_id', userId)
        .eq('work_date', workDate)
        .maybeSingle();
      
      const updateData = {
        employee_id: userId,
        work_date: workDate,
        [segmentType]: newValue,
        notes: existingTimesheet?.notes?.includes('[OVERRIDE MANUAL')
          ? existingTimesheet.notes
          : `[OVERRIDE MANUAL] Editat manual la ${new Date().toISOString()}`
      };
      
      if (existingTimesheet) {
        // Update
        await supabase
          .from('daily_timesheets')
          .update(updateData)
          .eq('id', existingTimesheet.id);
      } else {
        // Insert nou
        await supabase
          .from('daily_timesheets')
          .insert(updateData);
      }
      
      // Invalidate queries pentru refresh
      queryClient.invalidateQueries({ queryKey: ['team-time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      
      toast({
        title: `✅ ${getSegmentLabel(segmentType)} actualizat: ${newValue.toFixed(1)}h`,
      });
      
    } catch (error) {
      console.error('Error saving management hours:', error);
      toast({
        title: "Eroare la salvarea orelor",
        variant: "destructive",
      });
    }
  };

  // Mutation pentru editare ore segment
  const editSegmentHoursMutation = useMutation({
    mutationFn: async ({ userId, segmentType, newHours }: { userId: string; segmentType: string; newHours: number }) => {
      // Găsește primul pontaj al user-ului pentru a obține time_entry_id
      const employee = groupedByEmployee.find(e => e.userId === userId);
      if (!employee || employee.entries.length === 0) {
        throw new Error('Pontaj negăsit');
      }

      const timeEntryId = employee.entries[0].id;

      // Găsește toate segmentele de acest tip
      const segments = employee.segments.filter(s => s.type === segmentType);
      if (segments.length === 0) {
        throw new Error(`Nu există segmente de tip ${segmentType}`);
      }

      // Calculează total ore actuale pentru acest tip
      const currentTotalHours = segments.reduce((sum, s) => sum + s.duration, 0);
      
      // Calculează factorul de scalare
      const scaleFactor = newHours / currentTotalHours;

      // Update fiecare segment de acest tip proporțional
      for (const segment of segments) {
        const newDuration = segment.duration * scaleFactor;
        
        // Calculează noul end_time bazat pe durată
        const startTime = new Date(segment.startTime);
        const endTime = new Date(startTime.getTime() + newDuration * 60 * 60 * 1000);

        await supabase
          .from('time_entry_segments')
          .update({
            hours_decimal: newDuration,
            end_time: endTime.toISOString(),
          })
          .eq('id', segment.id);
      }

      return { userId, segmentType, newHours };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTimesheets'] });
      toast({
        title: '✅ Ore actualizate',
        description: 'Segmentele au fost recalculate',
      });
    },
    onError: (error: any) => {
      toast({
        title: '❌ Eroare',
        description: error.message || 'Nu s-au putut actualiza orele',
        variant: 'destructive',
      });
    },
  });

  // Mutation pentru editare Clock In/Out cu logging
  const editClockTimeMutation = useMutation({
    mutationFn: async ({ 
      scope, 
      fieldName, 
      newValue, 
      employee 
    }: { 
      scope: 'single' | 'team'; 
      fieldName: 'Clock In' | 'Clock Out'; 
      newValue: string; 
      employee: EmployeeDayData;
    }) => {
      // Determină angajații afectați
      const affectedEmployees = scope === 'team' 
        ? groupedByEmployee.filter(e => {
            const hasDriverSegments = e.segments.some(
              s => s.type === 'hours_driving' || s.type === 'hours_equipment'
            );
            const isCoord = e.entries.some(entry => 
              entry.user_id === teamLeader?.id || entry.user_id === coordinator?.id
            );
            return !hasDriverSegments && !isCoord;
          })
        : [employee];

      for (const emp of affectedEmployees) {
        const timeEntry = emp.entries[0];
        const oldClockIn = formatRomania(emp.firstClockIn, 'HH:mm');
        const oldClockOut = emp.lastClockOut ? formatRomania(emp.lastClockOut, 'HH:mm') : null;

        // Calculează noua valoare timestamp
        let updateData: any = {};
        
        if (fieldName === 'Clock In') {
          const [h, m] = newValue.split(':').map(Number);
          const newClockIn = new Date(emp.firstClockIn);
          newClockIn.setHours(h, m, 0, 0);
          updateData.clock_in_time = newClockIn.toISOString();
        } else {
          const [h, m] = newValue.split(':').map(Number);
          const newClockOut = new Date(emp.lastClockOut || emp.firstClockIn);
          newClockOut.setHours(h, m, 0, 0);
          updateData.clock_out_time = newClockOut.toISOString();
        }
        
        updateData.needs_reprocessing = true;

        // 1️⃣ Update time_entries
        const { error: updateError } = await supabase
          .from('time_entries')
          .update(updateData)
          .eq('id', timeEntry.id);

        if (updateError) throw updateError;

        // 2️⃣ Apelează edge function pentru recalculare segmente (FINAL MODE)
        const { error: calcError } = await supabase.functions.invoke('calculate-time-segments', {
          body: { 
            time_entry_id: timeEntry.id,
            isIntermediateCalculation: false,  // ✅ FIX 3: FORCE FINAL MODE
            force_recalculate: true 
          }
        });

        if (calcError) throw calcError;

        // 3️⃣ Șterge manualOverride dacă există
        if (emp.manualOverride) {
          // Calculează data pentru care se face ștergerea
          const workDate = new Date(selectedWeek);
          workDate.setDate(workDate.getDate() + selectedDayOfWeek);
          
          const { error: deleteError } = await supabase
            .from('daily_timesheets')
            .delete()
            .eq('employee_id', emp.userId)
            .eq('work_date', workDate.toISOString().split('T')[0]);

          if (deleteError) throw deleteError;
        }

        // 4️⃣ Log acțiunea în audit_logs
        const { data: { user } } = await supabase.auth.getUser();
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert({
            user_id: user?.id,
            action: scope === 'team' ? 'team_clock_time_edit' : 'individual_clock_time_edit',
            resource_type: 'time_entry',
            resource_id: timeEntry.id,
            details: {
              field: fieldName,
              old_value: fieldName === 'Clock In' ? oldClockIn : oldClockOut,
              new_value: newValue,
              scope: scope,
              affected_employees: scope === 'team' ? affectedEmployees.map(e => ({
                user_id: e.userId,
                full_name: e.fullName
              })) : undefined,
              had_manual_override: emp.manualOverride || false,
            }
          });

        if (auditError) console.error('Audit log failed:', auditError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-segments'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTimesheets'] });
      
      toast({
        title: '✅ Modificare aplicată',
        description: editDialog?.fieldName === 'Clock In' 
          ? 'Clock In actualizat și segmente recalculate'
          : 'Clock Out actualizat și segmente recalculate',
      });
      
      setEditDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: '❌ Eroare',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handler pentru click pe Clock In/Out
  const handleClockTimeClick = (employee: EmployeeDayData, fieldName: 'Clock In' | 'Clock Out') => {
    const currentValue = fieldName === 'Clock In' 
      ? formatRomania(employee.firstClockIn, 'HH:mm')
      : employee.lastClockOut ? formatRomania(employee.lastClockOut, 'HH:mm') : '';
    
    // Prompt pentru noua valoare
    const newValue = prompt(
      `Introdu noul ${fieldName} pentru ${employee.fullName} (format HH:MM):`,
      currentValue
    );
    
    if (!newValue || newValue === currentValue) return;
    
    // Validare format HH:MM
    if (!/^\d{2}:\d{2}$/.test(newValue)) {
      toast({
        title: '❌ Format invalid',
        description: 'Folosește formatul HH:MM (ex: 08:30)',
        variant: 'destructive',
      });
      return;
    }
    
    setEditDialog({
      open: true,
      fieldName,
      employee,
      currentValue,
      newValue,
    });
  };

  const handleSegmentHoursEdit = (userId: string, segmentType: string, newHours: number) => {
    if (newHours < 0 || newHours > 24) {
      toast({
        title: '⚠️ Valoare invalidă',
        description: 'Orele trebuie să fie între 0 și 24',
        variant: 'destructive',
      });
      return;
    }

    editSegmentHoursMutation.mutate({ userId, segmentType, newHours });
  };

  // ✅ FIX 2: Handler pentru uniformizare cu recalculare completă
  const handleUniformize = async (avgClockIn: string, avgClockOut: string | null) => {
    const isDriver = (segments: any[]) => segments.some((s: any) => s.type === 'hours_driving' || s.type === 'hours_equipment');
    const nonDrivers = groupedByEmployee.filter(emp => !isDriver(emp.segments));

    if (nonDrivers.length === 0) {
      toast({
        title: '⚠️ Niciun angajat eligibil',
        description: 'Nu există angajați în echipă (șoferii sunt excluși).',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Parse timpul mediu
      const [avgInHour, avgInMin] = avgClockIn.split(':').map(Number);
      const avgOutHour = avgClockOut ? parseInt(avgClockOut.split(':')[0]) : null;
      const avgOutMin = avgClockOut ? parseInt(avgClockOut.split(':')[1]) : null;

      // Update pentru fiecare non-driver
      for (const employee of nonDrivers) {
        const timeEntry = employee.entries[0];
        if (!timeEntry) continue;

        // 1️⃣ Calculează noile timestampuri
        const clockInDate = new Date(employee.firstClockIn);
        clockInDate.setHours(avgInHour, avgInMin, 0, 0);

        let clockOutDate: Date | null = null;
        if (avgOutHour !== null && avgOutMin !== null && employee.lastClockOut) {
          clockOutDate = new Date(employee.lastClockOut);
          clockOutDate.setHours(avgOutHour, avgOutMin, 0, 0);
        }

        // 2️⃣ Update Clock In/Out în time_entries
        const updateData: any = {
          clock_in_time: clockInDate.toISOString(),
        };
        
        if (clockOutDate) {
          updateData.clock_out_time = clockOutDate.toISOString();
        }

        const { error: updateError } = await supabase
          .from('time_entries')
          .update(updateData)
          .eq('id', timeEntry.id);

        if (updateError) throw updateError;

        // 3️⃣ Trigger recalculare COMPLETĂ prin edge function
        const { error: calcError } = await supabase.functions.invoke('calculate-time-segments', {
          body: { 
            time_entry_id: timeEntry.id,
            isIntermediateCalculation: false,  // ✅ FORCE FINAL MODE
            force_recalculate: true
          }
        });

        if (calcError) throw calcError;

        // 4️⃣ Șterge manual override dacă există
        if (employee.manualOverride) {
          const workDate = new Date(selectedWeek);
          workDate.setDate(workDate.getDate() + selectedDayOfWeek);
          
          const { error: deleteError } = await supabase
            .from('daily_timesheets')
            .delete()
            .eq('employee_id', employee.userId)
            .eq('work_date', workDate.toISOString().split('T')[0]);

          if (deleteError) console.error('[Delete Override Error]', deleteError);
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-segments'] });

      toast({
        title: '✅ Uniformizare completă',
        description: `${nonDrivers.length} angajați actualizați cu recalculare COMPLETĂ a segmentelor.`,
      });
      
      setUniformizeDialogOpen(false);
    } catch (error) {
      console.error('[Uniformize Error]', error);
      toast({
        title: '❌ Eroare la uniformizare',
        description: error instanceof Error ? error.message : 'Nu s-au putut actualiza orele',
        variant: 'destructive',
      });
    }
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
            <div className="flex items-center gap-4">
              <div>
                <CardTitle>Aprobare Pontaje</CardTitle>
                <CardDescription>
                  Săptămâna {format(new Date(selectedWeek), 'dd MMM yyyy', { locale: ro })}
                </CardDescription>
              </div>
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

          {/* ✅ SECȚIUNE MANAGEMENT - Șef Echipă + Coordonator */}
          {managementEntries.length > 0 && (
            <Collapsible className="mb-6">
              <Card className="border-2 border-primary/20">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Badge variant="default" className="bg-primary text-primary-foreground">
                            🎖️ Management
                          </Badge>
                        </div>
                        <div>
                          <CardTitle className="text-lg">Pontaje Management</CardTitle>
                          <CardDescription>
                            {managementEntries.length} {managementEntries.length === 1 ? 'pontaj' : 'pontaje'}
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:rotate-180" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {managementGroupedByUser.map((user) => {
                        const isTeamLeader = user.userId === teamLeader?.id;
                        const isApproved = user.approvalStatus === 'approved';
                        
                        return (
                          <div 
                            key={user.userId} 
                            className={`p-4 rounded-lg border ${isApproved ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-muted/30'}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant={isTeamLeader ? 'default' : 'secondary'} className={isTeamLeader ? 'bg-blue-600' : 'bg-purple-600'}>
                                    {isTeamLeader ? '👔 Șef Echipă' : '👑 Coordonator'}
                                  </Badge>
                                  <span className="font-semibold">{user.fullName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {user.username}
                                  </Badge>
                                  {isApproved && (
                                    <Badge variant="default" className="bg-green-600 text-white gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Aprobat
                                    </Badge>
                                  )}
                                  {user.manualOverride && (
                                    <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/30 border-orange-300">
                                      ✋ Manual
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                                    <p className="font-mono font-semibold">
                                      {formatRomania(user.firstClockIn, 'HH:mm')}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                                    <p className="font-mono font-semibold">
                                      {user.lastClockOut ? formatRomania(user.lastClockOut, 'HH:mm') : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Total Ore</p>
                                    <p className="font-mono font-semibold text-primary">
                                      {user.totalHours.toFixed(2)}h
                                    </p>
                                  </div>
                                </div>

          {/* Badge-uri standardizate de tipuri de ore - EDITABILE */}
          <div className="flex flex-wrap gap-2 mt-2">
            {standardTypes.map((t) => {
              const val = getDisplayHoursMgmt(user, t);
              if (val <= 0) return null; // afișăm doar > 0
              const label = getSegmentLabel(t);
              const icon = getSegmentIcon(t);
              const isEditing = editingManagementHours.userId === user.userId 
                && editingManagementHours.segmentType === t;
              
              return (
                <div key={t} className="inline-flex items-center gap-1">
                  {!isEditing ? (
                    // Badge clickable pentru a intra în editare
                    <Badge 
                      variant="secondary" 
                      className="text-xs gap-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => setEditingManagementHours({
                        userId: user.userId,
                        segmentType: t,
                        value: val.toFixed(1)
                      })}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                      <span className="font-mono">{val.toFixed(1)}h</span>
                    </Badge>
                  ) : (
                    // Input + butoane Save/Cancel
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        value={editingManagementHours.value}
                        onChange={(e) => setEditingManagementHours(prev => ({
                          ...prev,
                          value: e.target.value
                        }))}
                        className="w-16 h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveManagementSegmentHours(
                              user.userId,
                              t,
                              parseFloat(editingManagementHours.value) || 0
                            );
                            setEditingManagementHours({ userId: null, segmentType: null, value: '' });
                          } else if (e.key === 'Escape') {
                            setEditingManagementHours({ userId: null, segmentType: null, value: '' });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          handleSaveManagementSegmentHours(
                            user.userId,
                            t,
                            parseFloat(editingManagementHours.value) || 0
                          );
                          setEditingManagementHours({ userId: null, segmentType: null, value: '' });
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingManagementHours({ 
                          userId: null, 
                          segmentType: null, 
                          value: '' 
                        })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
                              </div>

                              <div className="flex gap-2">
                                {!isApproved && (
                                  <Button
                                    onClick={() => {
                                      // Găsim prima intrare pending a utilizatorului
                                      const entry = managementEntries.find(e => e.user_id === user.userId);
                                      if (entry) handleApprove(entry.id);
                                    }}
                                    size="sm"
                                    variant="default"
                                    className="gap-2"
                                  >
                                    <Check className="h-4 w-4" />
                                    Aprobă
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {groupedByEmployee.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium">Nu există pontaje</p>
            </div>
          ) : (
            // ✅ VIZUALIZARE TABEL (tab "Detalii" eliminat)
            <TeamTimeComparisonTable
              groupedByEmployee={groupedByEmployee}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onApprove={handleApprove}
              onUniformize={() => setUniformizeDialogOpen(true)}
              onTimeClick={handleTimeClick}
              editingSegment={editingSegment}
              onTimeChange={handleTimeChange}
              onTimeSave={handleTimeSave}
              onTimeCancel={handleTimeCancel}
              onSegmentHoursEdit={handleSegmentHoursEdit}
              onClockInEdit={(emp) => handleClockTimeClick(emp, 'Clock In')}
              onClockOutEdit={(emp) => handleClockTimeClick(emp, 'Clock Out')}
            />
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
      
      {/* Team Edit Scope Dialog */}
      {editDialog && (
        <TeamEditScopeDialog
          open={editDialog.open}
          onOpenChange={(open) => !open && setEditDialog(null)}
          fieldName={editDialog.fieldName}
          employeeName={editDialog.employee.fullName}
          currentValue={editDialog.currentValue}
          newValue={editDialog.newValue}
          affectedCount={groupedByEmployee.filter(e => {
            const hasDriverSegments = e.segments.some(
              s => s.type === 'hours_driving' || s.type === 'hours_equipment'
            );
            const isCoord = e.entries.some(entry => 
              entry.user_id === teamLeader?.id || entry.user_id === coordinator?.id
            );
            return !hasDriverSegments && !isCoord;
          }).length}
          employeesWithManualOverride={groupedByEmployee
            .filter(e => e.manualOverride)
            .map(e => e.fullName)
          }
          onConfirm={(scope) => {
            editClockTimeMutation.mutate({
              scope,
              fieldName: editDialog.fieldName,
              newValue: editDialog.newValue,
              employee: editDialog.employee,
            });
          }}
        />
      )}

      {editEntry && (
        <TimeEntryApprovalEditDialog
          entry={editEntry}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditEntry(null);
          }}
          onSuccess={() => {
            // Marchează echipa ca editată, DAR NU schimba automat echipa
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              toast({
                title: '✅ Pontaj editat și aprobat',
                description: 'Selectează manual următoarea echipă din dropdown.',
              });
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
            // Marchează echipa ca editată, DAR NU schimba automat echipa
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              toast({
                title: '✅ Pontaj șters',
                description: 'Selectează manual următoarea echipă din dropdown.',
              });
            }
          }}
        />
      )}

      <UniformizeDialog
        open={uniformizeDialogOpen}
        onOpenChange={setUniformizeDialogOpen}
        groupedByEmployee={groupedByEmployee}
        onConfirm={handleUniformize}
      />
    </>
  );
};

