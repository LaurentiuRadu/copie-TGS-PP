import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertCircle, Calendar, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, Info, CheckCircle2, RefreshCw, Trash2, RotateCcw, Table as TableIcon, List, X, Plus } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { ro } from 'date-fns/locale';
import { formatRomania } from '@/lib/timezone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { DeleteTimeEntryDialog } from '@/components/DeleteTimeEntryDialog';
import { AddMissingEntryDialog } from '@/components/AddMissingEntryDialog';
import { TeamTimeComparisonTable } from '@/components/TeamTimeComparisonTable';
import { UniformizeDialog } from '@/components/UniformizeDialog';
import { TeamEditScopeDialog } from '@/components/TeamEditScopeDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDailyTimesheets, type DailyTimesheet } from '@/hooks/useDailyTimesheets';
import { useUserRole } from '@/hooks/useUserRole';
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
  // Verificare rol admin pentru restricționare editare management
  const { isAdmin } = useUserRole();

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
  
  // Ref pentru scroll automat la tabel comparație
  const comparisonTableRef = useRef<HTMLDivElement>(null);
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
  const [addMissingDialogOpen, setAddMissingDialogOpen] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState<EmployeeDayData | null>(null);
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
    // ✅ Permitem entries "missing" să treacă
    if (entry.isMissing) return true;
    
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
  
  // ✅ Separăm incomplete (au clock_in, lipsă clock_out) și missing (nu s-au pontajat deloc)
  const incompleteEntries = pendingEntries.filter(e => 
    e.clock_in_time && !e.clock_out_time && !e.isMissing && e.approval_status !== 'approved'
  );
  
  // 🐛 DEBUG: Log incomplete entries details
  console.log('[Incomplete Check]', {
    total_pending: pendingEntries.length,
    incomplete_count: incompleteEntries.length,
    incomplete_details: incompleteEntries.map(e => ({ 
      id: e.id.slice(0, 8), 
      name: e.profiles?.full_name, 
      isMissing: e.isMissing,
      has_clock_in: !!e.clock_in_time,
      has_clock_out: !!e.clock_out_time,
      status: e.approval_status
    }))
  });
  
  const missingEntries = pendingEntries.filter(e => e.isMissing);
  
  // ✅ Entries COMPLETE (exclude missing) pentru statistici corecte
  const actualValidEntries = validPendingEntries.filter(e => !e.isMissing && e.clock_out_time);
  
  // ✅ displayedEntries = complete + missing (pentru tabel)
  const displayedEntries = [...actualValidEntries, ...missingEntries];

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
    isMissing?: boolean;
    scheduled_shift?: string;
    scheduled_location?: string;
    scheduled_activity?: string;
    scheduled_vehicle?: string;
  }

  const groupedByEmployee = useMemo(() => {
    const grouped = new Map<string, EmployeeDayData>();
    
    displayedEntries.forEach(entry => {
      const userId = entry.user_id;
      
      // ✅ Procesăm mai întâi entries cu isMissing
      if (entry.isMissing) {
        grouped.set(userId, {
          userId,
          fullName: entry.profiles.full_name,
          username: entry.profiles.username,
          totalHours: 0,
          firstClockIn: '',
          lastClockOut: null,
          segments: [],
          entries: [entry],
          allApproved: false,
          isMissing: true,
          scheduled_shift: entry.scheduled_shift,
          scheduled_location: entry.scheduled_location,
          scheduled_activity: entry.scheduled_activity,
          scheduled_vehicle: entry.scheduled_vehicle,
        });
        return;
      }
      
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
      
      // Update first/last timestamps - ✅ SAFE: verificăm null pentru missing entries
      if (entry.clock_in_time && (!employeeData.firstClockIn || entry.clock_in_time < employeeData.firstClockIn)) {
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
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
    // ✅ Verificare de securitate: doar adminii pot edita management
    if (!isAdmin) {
      toast({
        title: '🚫 Acces Interzis',
        description: 'Doar adminii pot edita pontajele pentru management',
        variant: 'destructive',
      });
      return;
    }

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
      
      // ✅ VALIDARE 2: Calculează DELTA (diferența) în loc de total complet
      // Găsim daily_timesheet pentru utilizator
      const dailyTimesheet = overrideByUser.get(userId);
      if (!dailyTimesheet) {
        toast({
          title: "Nu s-a găsit pontajul",
          variant: "destructive",
        });
        return;
      }

      // Calculează totalul ACTUAL din daily_timesheet
      let currentTotalSegments = 0;
      standardTypes.forEach(type => {
        currentTotalSegments += dailyTimesheet[type] || 0;
      });

      // Calculează valoarea veche și diferența (delta)
      const oldValue = dailyTimesheet[segmentType] || 0;
      const segmentDelta = newValue - oldValue;
      const newTotalSegments = currentTotalSegments + segmentDelta;

      // ✅ VALIDARE 3: Pentru management, afișăm doar avertizare (permitem oricum salvarea)
      if (newTotalSegments > totalAvailableHours + 0.05) { // +3 minute toleranță
        toast({
          title: "⚠️ Atenție: Totalul segmentelor depășește Clock In/Out",
          description: `Se salvează oricum (management) — total ${newTotalSegments.toFixed(1)}h vs. disponibil ${totalAvailableHours.toFixed(1)}h`,
        });
        // continuăm fără return — flexibilitate pentru coordonator / șef echipă
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
      
      // ✅ FIX 1: Optimistic update în cache ÎNAINTE de invalidate
      queryClient.setQueryData(
        QUERY_KEYS.dailyTimesheets(dayDate),
        (oldData: DailyTimesheet[] | undefined) => {
          if (!oldData) return oldData;
          
          const existingIndex = oldData.findIndex(
            dt => dt.employee_id === userId && dt.work_date === workDate
          );
          
          if (existingIndex >= 0) {
            // Update existing
            const newData = [...oldData];
            newData[existingIndex] = {
              ...newData[existingIndex],
              [segmentType]: newValue,
              updated_at: new Date().toISOString(),
            };
            return newData;
          } else {
            // Add new - folosim as unknown pentru a evita type mismatch
            return [...oldData, updateData as unknown as DailyTimesheet];
          }
        }
      );
      
      // Invalidate queries pentru refresh - FIX pentru actualiz date în UI
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets(dayDate) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myDailyTimesheets() });
      
      toast({
        title: `✅ Ore actualizate`,
        description: `${getSegmentLabel(segmentType)}: ${newValue.toFixed(1)}h`,
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
      
      // ✅ FIX: Dacă nu există segmente SAU e Manual Override → update direct în daily_timesheets
      if (segments.length === 0 || employee.manualOverride) {
        const workDate = format(dayDate, 'yyyy-MM-dd');
        const standardTypes = ['hours_regular', 'hours_night', 'hours_saturday', 'hours_sunday', 'hours_holiday', 'hours_passenger', 'hours_driving', 'hours_equipment'];
        
        // Construim payload cu valorile curente + modificarea nouă
        const overridePayload: any = {
          employee_id: userId,
          work_date: workDate,
          notes: employee.manualOverride 
            ? '[SEGMENTARE MANUALĂ] Actualizat din tabel (mod manual)'
            : '[SEGMENTARE MANUALĂ] Creat automat (fără segmente)',
        };
        
        // Populăm fiecare tip cu valorile curente (din overrideHours sau 0)
        standardTypes.forEach((t) => {
          if (t === segmentType) {
            overridePayload[t] = Number(newHours.toFixed(2));
          } else if (employee.overrideHours) {
            overridePayload[t] = Number((employee.overrideHours[t] || 0).toFixed(2));
          } else {
            overridePayload[t] = 0;
          }
        });

        // Upsert în daily_timesheets
        const { data: existing } = await supabase
          .from('daily_timesheets')
          .select('id')
          .eq('employee_id', userId)
          .eq('work_date', workDate)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('daily_timesheets')
            .update(overridePayload)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('daily_timesheets')
            .insert(overridePayload);
        }

        return { userId, segmentType, newHours, isManualOverride: true };
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

      return { userId, segmentType, newHours, isManualOverride: false };
    },
    onSuccess: async (data) => {
      // ✅ FIX 2: Force refetch IMEDIAT (nu doar invalidate)
      await queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.teamPendingApprovals(),
      });
      await queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.dailyTimesheets(),
      });
      
      toast({
        title: '✅ Ore actualizate',
        description: data.isManualOverride 
          ? 'Orele au fost salvate (mod manual)' 
          : 'Segmentele au fost recalculate',
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

  // Mutation pentru adăugare pontaj manual (angajați lipsă)
  const addManualEntryMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      clockIn: string;
      clockOut: string;
      shiftType: string;
      notes: string;
    }) => {
      console.log('[Manual Entry] Creating entry:', data);

      // 1. Creează time_entry
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .insert({
          user_id: data.userId,
          clock_in_time: data.clockIn,
          clock_out_time: data.clockOut,
          notes: `[ADĂUGAT MANUAL] ${data.notes}`,
          approval_status: 'pending_review',
          was_edited_by_admin: true,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // 2. Trigger calcul segmente automat
      const { error: calcError } = await supabase.functions.invoke('calculate-time-segments', {
        body: {
          user_id: data.userId,
          time_entry_id: entry.id,
          clock_in_time: data.clockIn,
          clock_out_time: data.clockOut,
          notes: data.shiftType,
        },
      });

      if (calcError) {
        console.warn('[Manual Entry] Segment calculation warning:', calcError);
      }

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timeEntries() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
      toast({
        title: '✅ Pontaj adăugat',
        description: 'Segmentele au fost calculate automat.',
      });

      setAddMissingDialogOpen(false);
      setAddingEmployee(null);
    },
    onError: (error) => {
      console.error('[Manual Entry Error]', error);
      toast({
        title: '❌ Eroare',
        description: error instanceof Error ? error.message : 'Nu s-a putut adăuga pontajul',
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });
      queryClient.invalidateQueries({ queryKey: ['time-entry-segments'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
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
    // ✅ Verificare de securitate pentru management
    const isManagement = managementEntries.some(e => e.user_id === employee.userId);
    if (isManagement && !isAdmin) {
      toast({
        title: '🚫 Acces Interzis',
        description: 'Doar adminii pot edita Clock In/Out pentru management',
        variant: 'destructive',
      });
      return;
    }

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

  // Handler pentru butonul "Adaugă Pontaj Manual"
  const handleAddManualEntry = (employee: EmployeeDayData) => {
    setAddingEmployee(employee);
    setAddMissingDialogOpen(true);
  };

  // Handler pentru confirm manual entry din dialog
  const handleConfirmManualEntry = (data: {
    clockIn: string;
    clockOut: string;
    shiftType: string;
    notes: string;
  }) => {
    if (!addingEmployee) return;

    addManualEntryMutation.mutate({
      userId: addingEmployee.userId,
      ...data,
    });
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
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

          {/* Alert pentru echipă incompletă */}
          {(incompleteEntries.length > 0 || missingEntries.length > 0) && (
            <Alert className="mb-4 border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">
                    ⚠️ {incompleteEntries.length + missingEntries.length} angajați cu probleme:
                  </p>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    {incompleteEntries.map(e => (
                      <li key={e.id}>
                        <strong>{e.profiles.full_name}</strong> - 🚨 lipsă clock-out
                      </li>
                    ))}
                    
                    {missingEntries.map(e => (
                      <li key={e.user_id}>
                        <strong>{e.profiles.full_name}</strong> - ❌ programat dar fără pontaj
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    👉 Vezi secțiunea{' '}
                    <button
                      onClick={() => {
                        comparisonTableRef.current?.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'start' 
                        });
                        // Highlight temporar
                        comparisonTableRef.current?.classList.add('highlight-pulse');
                        setTimeout(() => {
                          comparisonTableRef.current?.classList.remove('highlight-pulse');
                        }, 2000);
                      }}
                      className="font-bold text-primary underline hover:text-primary/80 transition-colors cursor-pointer"
                    >
                      "📊 Comparație Pontaje Echipă"
                    </button>{' '}
                    de mai jos pentru a edita manual sau adăuga pontaje lipsă
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {(actualValidEntries.length > 0 || missingEntries.length > 0) && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Total pontaje complete</p>
                  <p className="text-2xl font-bold">{actualValidEntries.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">În așteptare</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {actualValidEntries.filter(e => e.approval_status === 'pending_review').length}
                  </p>
                </div>
                {actualValidEntries.filter(e => e.approval_status === 'approved').length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Deja aprobate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {actualValidEntries.filter(e => e.approval_status === 'approved').length}
                    </p>
                  </div>
                )}
                {incompleteEntries.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nefinalizate (fără clock-out)</p>
                    <p className="text-2xl font-bold text-orange-600">{incompleteEntries.length}</p>
                  </div>
                )}
                {missingEntries.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lipsă complet</p>
                    <p className="text-2xl font-bold text-red-600">{missingEntries.length}</p>
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
                            👔 Supervizori și Coordonatori
                          </Badge>
                        </div>
                        <div>
                          <CardTitle className="text-lg">Pontaje Supervizori și Coordonatori</CardTitle>
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
                                  {/* Clock In - editabil cu buton */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                                    <button
                                      onClick={() => {
                                        // Găsește entry-ul management pentru acest user
                                        const managementEntry = managementEntries.find(e => e.user_id === user.userId);
                                        if (managementEntry) {
                                          // Convertim la format EmployeeDayData
                                          const employeeData: EmployeeDayData = {
                                            userId: user.userId,
                                            fullName: user.fullName,
                                            username: user.username,
                                            totalHours: user.totalHours,
                                            firstClockIn: user.firstClockIn,
                                            lastClockOut: user.lastClockOut,
                                            segments: managementEntry.segments?.map(s => ({
                                              id: s.id,
                                              type: s.segment_type,
                                              startTime: s.start_time,
                                              endTime: s.end_time,
                                              duration: s.hours_decimal,
                                            })) || [],
                                            entries: managementEntries.filter(e => e.user_id === user.userId),
                                            allApproved: user.approvalStatus === 'approved',
                                            manualOverride: user.manualOverride,
                                            overrideHours: user.overrideHours,
                                          };
                                          handleClockTimeClick(employeeData, 'Clock In');
                                        }
                                      }}
                                      className="font-mono font-semibold hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      {formatRomania(user.firstClockIn, 'HH:mm')}
                                      <Pencil className="h-3 w-3 opacity-60" />
                                    </button>
                                  </div>
                                  {/* Clock Out - editabil doar pentru admini */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                                    {isAdmin ? (
                                      <button
                                        onClick={() => {
                                          // Găsește entry-ul management pentru acest user
                                          const managementEntry = managementEntries.find(e => e.user_id === user.userId);
                                          if (managementEntry && user.lastClockOut) {
                                            // Convertim la format EmployeeDayData
                                            const employeeData: EmployeeDayData = {
                                              userId: user.userId,
                                              fullName: user.fullName,
                                              username: user.username,
                                              totalHours: user.totalHours,
                                              firstClockIn: user.firstClockIn,
                                              lastClockOut: user.lastClockOut,
                                              segments: managementEntry.segments?.map(s => ({
                                                id: s.id,
                                                type: s.segment_type,
                                                startTime: s.start_time,
                                                endTime: s.end_time,
                                                duration: s.hours_decimal,
                                              })) || [],
                                              entries: managementEntries.filter(e => e.user_id === user.userId),
                                              allApproved: user.approvalStatus === 'approved',
                                              manualOverride: user.manualOverride,
                                              overrideHours: user.overrideHours,
                                            };
                                            handleClockTimeClick(employeeData, 'Clock Out');
                                          }
                                        }}
                                        className="font-mono font-semibold hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        {user.lastClockOut ? formatRomania(user.lastClockOut, 'HH:mm') : '—'}
                                        {user.lastClockOut && <Pencil className="h-3 w-3 opacity-60" />}
                                      </button>
                                    ) : (
                                      <span className="font-mono font-semibold">
                                        {user.lastClockOut ? formatRomania(user.lastClockOut, 'HH:mm') : '—'}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Total Ore</p>
                                    <p className="font-mono font-semibold text-primary">
                                      {user.totalHours.toFixed(2)}h
                                    </p>
                                  </div>
                                </div>

          {/* Badge-uri standardizate de tipuri de ore - EDITABILE doar pentru admini */}
          <div className="flex flex-wrap gap-2 mt-2">
            {standardTypes.map((t) => {
              const val = getDisplayHoursMgmt(user, t);
              const label = getSegmentLabel(t);
              const icon = getSegmentIcon(t);
              const isEditing = editingManagementHours.userId === user.userId 
                && editingManagementHours.segmentType === t;
              
              // Dacă user NU este admin, afișează doar badge-uri read-only
              if (!isAdmin) {
                if (val <= 0) return null; // Nu afișa tipuri cu 0h
                return (
                  <Badge 
                    key={t}
                    variant="secondary" 
                    className="text-xs gap-1"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    <span className="font-mono">{val.toFixed(1)}h</span>
                  </Badge>
                );
              }
              
              // DOAR pentru admini: afișăm butoane editare
              if (val <= 0 && !isEditing) {
                // Buton "+" pentru a adăuga tipul de ore
                return (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 opacity-60 hover:opacity-100"
                    onClick={() => setEditingManagementHours({
                      userId: user.userId,
                      segmentType: t,
                      value: '0.0'
                    })}
                  >
                    <Plus className="h-3 w-3" />
                    <span>{icon}</span>
                    <span>{label}</span>
                  </Button>
                );
              }
              
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
                        className="w-16 h-8 text-sm font-mono"
                        autoFocus
                        onFocus={(e) => e.target.select()}
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
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleSaveManagementSegmentHours(
                            user.userId,
                            t,
                            parseFloat(editingManagementHours.value) || 0
                          );
                          setEditingManagementHours({ userId: null, segmentType: null, value: '' });
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditingManagementHours({ 
                          userId: null, 
                          segmentType: null, 
                          value: '' 
                        })}
                      >
                        <X className="h-4 w-4" />
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
            <>
              {/* 📊 HEADER PENTRU TABEL COMPARAȚIE */}
              <div ref={comparisonTableRef} className="mb-4 pb-3 border-b scroll-mt-20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TableIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">📊 Comparație Pontaje Echipă</h3>
                    <p className="text-sm text-muted-foreground">
                      Editează manual clock-in/out, segmente sau adaugă pontaje lipsă
                    </p>
                  </div>
                </div>
              </div>

              {/* ✅ VIZUALIZARE TABEL (tab "Detalii" eliminat) */}
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
              onAddManualEntry={handleAddManualEntry}
            />
            </>
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

      <AddMissingEntryDialog
        open={addMissingDialogOpen}
        onOpenChange={setAddMissingDialogOpen}
        employee={{
          userId: addingEmployee?.userId || '',
          fullName: addingEmployee?.fullName || '',
          username: addingEmployee?.username || '',
          scheduledShift: addingEmployee?.scheduled_shift,
          scheduledLocation: addingEmployee?.scheduled_location,
        }}
        workDate={dayDate}
        onConfirm={handleConfirmManualEntry}
      />
    </>
  );
};

