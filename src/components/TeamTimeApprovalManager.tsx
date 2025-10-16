import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertCircle, Calendar, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, Info, CheckCircle2, RefreshCw, Trash2, RotateCcw, Table as TableIcon, List } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatRomania } from '@/lib/timezone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { DeleteTimeEntryDialog } from '@/components/DeleteTimeEntryDialog';
import { TeamTimeComparisonTable } from '@/components/TeamTimeComparisonTable';
import { UniformizeDialog } from '@/components/UniformizeDialog';
import { BulkClockTimeEditDialog } from '@/components/BulkClockTimeEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [uniformizeDialogOpen, setUniformizeDialogOpen] = useState(false);
  const [bulkClockEditDialogOpen, setBulkClockEditDialogOpen] = useState(false);
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

  // ✅ FETCH DAILY TIMESHEETS pentru detectare segmentare manuală
  const selectedDate = useMemo(() => {
    if (!selectedWeek) return null;
    return addDays(new Date(selectedWeek), selectedDayOfWeek - 1);
  }, [selectedWeek, selectedDayOfWeek]);

  const userIds = useMemo(() => {
    return Array.from(new Set(displayedEntries.map(e => e.user_id)));
  }, [displayedEntries]);

  const { data: dailyTimesheets = [] } = useQuery({
    queryKey: ['daily-timesheets-for-approval', selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null, userIds],
    queryFn: async () => {
      if (!selectedDate || userIds.length === 0) return [];
      
      const workDate = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('daily_timesheets')
        .select('*')
        .eq('work_date', workDate)
        .in('employee_id', userIds);
      
      if (error) throw error;
      
      console.log('[DailyTimesheets]', workDate, 'records:', data?.length || 0);
      
      return data || [];
    },
    enabled: !!selectedDate && userIds.length > 0,
  });

  // Map daily timesheets by user for quick lookup
  const dailyByUser = useMemo(() => {
    const map = new Map();
    dailyTimesheets.forEach(dt => {
      map.set(dt.employee_id, dt);
    });
    return map;
  }, [dailyTimesheets]);

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
    realEntries: TimeEntryForApproval[]; // ✅ Entry-uri REALE pentru editare
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
          realEntries: [], // ✅ Păstrăm entry-urile reale separate
          allApproved: true,
        });
      }
      
      const employeeData = grouped.get(userId)!;
      employeeData.entries.push(entry);
      employeeData.realEntries.push(entry); // ✅ Păstrăm și în realEntries pentru butonul Edit
      
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
    
    // ✅ DETECTARE SEGMENTARE MANUALĂ și override cu daily_timesheets
    grouped.forEach((emp, userId) => {
      // Check dacă există marker de segmentare manuală (folosim includes pentru robustețe)
      const hasManualSegmentation = emp.entries.some(e => 
        (e.approval_notes || '').includes('[SEGMENTARE MANUALĂ]') ||
        (e.approval_notes || '').includes('[OVERRIDE MANUAL')
      );
      
      // Fallback: dacă suma segmentelor auto depășește 24h, e clar că e greșit
      const autoSumExceeds24h = emp.totalHours > 24;
      
      const dailyRecord = dailyByUser.get(userId);
      
      if ((hasManualSegmentation || autoSumExceeds24h) && dailyRecord) {
        console.log(`[Segments Override] Using manual daily_timesheets for ${emp.fullName} (${userId})`);
        
        // Construim segmente sintetice din daily_timesheets
        const syntheticSegments = [];
        let syntheticTotal = 0;
        
        // Map pentru fielduri și tipuri
        const fieldMapping = [
          { field: 'hours_regular', type: 'hours_regular' },
          { field: 'hours_night', type: 'hours_night' },
          { field: 'hours_saturday', type: 'hours_saturday' },
          { field: 'hours_sunday', type: 'hours_sunday' },
          { field: 'hours_holiday', type: 'hours_holiday' },
          { field: 'hours_passenger', type: 'hours_passenger' },
          { field: 'hours_driving', type: 'hours_driving' },
          { field: 'hours_equipment', type: 'hours_equipment' },
        ];
        
        // ✅ Calculăm start time pentru segmente
        const totalStartTime = new Date(emp.firstClockIn);
        
        // Creăm segmente cu intervale de timp proporționale
        let currentTime = new Date(totalStartTime);
        
        fieldMapping.forEach(({ field, type }) => {
          const value = Number(dailyRecord[field]) || 0;
          if (value > 0) {
            // Calculăm end time pentru acest segment (proporțional cu durata)
            const segmentEndTime = new Date(currentTime.getTime() + value * 60 * 60 * 1000);
            
            syntheticSegments.push({
              id: `synthetic-${field}-${userId}`,
              type: type,
              startTime: currentTime.toISOString(),
              endTime: segmentEndTime.toISOString(),
              duration: value,
            });
            
            syntheticTotal += value;
            currentTime = segmentEndTime; // Următorul segment începe unde s-a terminat acesta
          }
        });
        
        // ✅ ACUM calculăm lastClockOut DUPĂ ce avem syntheticTotal
        emp.lastClockOut = currentTime.toISOString();
        
        // Override-ul complet
        emp.segments = syntheticSegments;
        emp.totalHours = Math.round(syntheticTotal * 100) / 100;
      } else {
        // Sortăm segmentele cronologic pentru cazuri normale
        emp.segments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        emp.totalHours = Math.round(emp.totalHours * 100) / 100;
      }
    });
    
    return Array.from(grouped.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [displayedEntries, dailyByUser]);

  // Keep Map version for BulkClockTimeEditDialog
  const groupedByEmployeeMap = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      userName: string;
      entries: Array<{
        id: string;
        clock_in_time: string;
        clock_out_time: string | null;
      }>;
    }>();
    
    groupedByEmployee.forEach(emp => {
      map.set(emp.userId, {
        userId: emp.userId,
        userName: emp.fullName,
        entries: emp.entries.map(e => ({
          id: e.id,
          clock_in_time: e.clock_in_time,
          clock_out_time: e.clock_out_time,
        })),
      });
    });
    
    return map;
  }, [groupedByEmployee]);

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
      
      // Get start and end times from segment
      const startTime = new Date(currentSegment.startTime);
      const endTime = new Date(currentSegment.endTime);

      let newDate: Date;

      if (field === 'startTime') {
        // Pentru start time: păstrează ziua start-ului
        newDate = new Date(startTime);
        newDate.setHours(hours, minutes, 0, 0);
      } else {
        // Pentru end time: detectează automat ziua corectă
        newDate = new Date(startTime); // Începe cu ziua start-ului
        newDate.setHours(hours, minutes, 0, 0);
        
        // Dacă ora end < ora start → presupune ziua următoare
        if (hours < startTime.getHours() || 
            (hours === startTime.getHours() && minutes < startTime.getMinutes())) {
          newDate.setDate(newDate.getDate() + 1);
          console.log('[Update Segment] Detected next day for end time');
        }
      }

      console.log('[Update Segment] New Date:', newDate.toISOString());

      // Calculate new duration
      const finalStartTime = field === 'startTime' ? newDate : startTime;
      const finalEndTime = field === 'endTime' ? newDate : endTime;
      const durationMs = finalEndTime.getTime() - finalStartTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      console.log('[Update Segment] New Duration:', durationHours.toFixed(2), 'hours');

      // Validare relaxată
      if (durationHours <= 0) {
        throw new Error(`Durata trebuie să fie pozitivă (calculat: ${durationHours.toFixed(2)}h)`);
      }

      // WARNING pentru durate mari (dar permite salvarea)
      if (durationHours > 24) {
        console.warn(`[Update Segment] WARNING: Durată mare detectată: ${durationHours.toFixed(2)}h`);
        toast({
          title: '⚠️ Atenție: Durată mare',
          description: `Segment de ${durationHours.toFixed(2)}h detectat. Verifică dacă ora de sfârșit este în ziua următoare!`,
          variant: 'default',
        });
      }
      
      // ✅ BLOCARE: Nu permite salvarea segmentelor sintetice
      if (segmentId.startsWith('synthetic-')) {
        throw new Error('Nu poți salva modificări pe segmente sintetice. Folosește "Editează Clock In/Out" sau repartizează manual din dialogul de aprobare.');
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
    
    // ✅ SEGMENT SINTETIC: Deschide dialogul de editare cu entry-ul REAL
    if (segmentId.startsWith('synthetic-')) {
      console.log('[handleTimeClick] Segment sintetic detectat, deschid dialogul cu entry-ul real:', segmentId);
      
      // Găsește datele angajatului
      const employeeData = groupedByEmployee.find(emp => emp.userId === userId);
      
      // Încearcă să găsești entry-ul real
      const realEntry = employeeData?.realEntries?.[0] || employeeData?.entries?.[0];
      
      if (realEntry) {
        // Deschide dialogul de editare cu entry-ul real
        setEditEntry(realEntry);
        setEditDialogOpen(true);
      } else {
        toast({
          title: '⚠️ Nu există pontaj real',
          description: 'Folosește butonul "Editează Clock In/Out".',
          variant: 'default',
        });
      }
      return;
    }
    
    // Extract HH:mm from ISO timestamp pentru editare inline
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

  // Handler pentru uniformizare
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
        const firstSegment = employee.segments[0];
        const lastSegment = employee.segments[employee.segments.length - 1];

        if (!firstSegment || !lastSegment) continue;

        // Update Clock In (primul segment)
        const clockInDate = new Date(firstSegment.startTime);
        clockInDate.setHours(avgInHour, avgInMin, 0, 0);

        // Update Clock Out (ultimul segment)
        let clockOutDate: Date | null = null;
        if (avgOutHour !== null && avgOutMin !== null && employee.lastClockOut) {
          clockOutDate = new Date(lastSegment.endTime);
          clockOutDate.setHours(avgOutHour, avgOutMin, 0, 0);
        }

        // Calculează noua durată pentru primul segment
        const firstSegmentEnd = new Date(firstSegment.endTime);
        const firstSegmentDuration = (firstSegmentEnd.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);

        // Update primul segment (Clock In)
        await supabase
          .from('time_entry_segments')
          .update({
            start_time: clockInDate.toISOString(),
            hours_decimal: firstSegmentDuration,
          })
          .eq('id', firstSegment.id);

        // Update ultimul segment (Clock Out) dacă există
        if (clockOutDate) {
          const lastSegmentStart = new Date(lastSegment.startTime);
          const lastSegmentDuration = (clockOutDate.getTime() - lastSegmentStart.getTime()) / (1000 * 60 * 60);

          await supabase
            .from('time_entry_segments')
            .update({
              end_time: clockOutDate.toISOString(),
              hours_decimal: lastSegmentDuration,
            })
            .eq('id', lastSegment.id);
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTimesheets'] });

      toast({
        title: '✅ Uniformizare completă',
        description: `${nonDrivers.length} angajați au fost actualizați la orele medii.`,
      });
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
              
              {/* Toggle pentru vizualizare */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'details')}>
                <TabsList>
                  <TabsTrigger value="table" className="flex items-center gap-2">
                    <TableIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Tabel</span>
                  </TabsTrigger>
                  <TabsTrigger value="details" className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">Detalii</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
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
          ) : viewMode === 'table' ? (
            // ✅ VIZUALIZARE TABEL ORIZONTAL
            <TeamTimeComparisonTable
              groupedByEmployee={groupedByEmployee}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUniformize={() => setUniformizeDialogOpen(true)}
              onBulkClockEdit={() => setBulkClockEditDialogOpen(true)}
              onTimeClick={handleTimeClick}
              editingSegment={editingSegment}
              onTimeChange={handleTimeChange}
              onTimeSave={handleTimeSave}
              onTimeCancel={handleTimeCancel}
              selectedDay={format(addDays(new Date(selectedWeek), selectedDayOfWeek), 'yyyy-MM-dd')}
              selectedTeam={selectedTeam || ''}
            />
          ) : (
            // ✅ VIZUALIZARE DETALII (UI VERTICAL EXISTENT)
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
                          const isEditingStart = editingSegment?.userId === employee.userId && 
                                                 editingSegment?.segmentIndex === idx &&
                                                 editingSegment?.field === 'startTime';
                          const isEditingEnd = editingSegment?.userId === employee.userId && 
                                               editingSegment?.segmentIndex === idx &&
                                               editingSegment?.field === 'endTime';
                          
                          return (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                              <span className="text-2xl">{getSegmentIcon(segment.type)}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{getSegmentLabel(segment.type)}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {segment.duration.toFixed(2)}h
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {isEditingStart ? (
                                    <Input
                                      type="time"
                                      value={editingSegment.value}
                                      onChange={(e) => handleTimeChange(e.target.value)}
                                      onBlur={() => handleTimeSave(employee)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTimeSave(employee);
                                        if (e.key === 'Escape') handleTimeCancel();
                                      }}
                                      autoFocus
                                      className="w-24 h-7 text-xs"
                                    />
                                  ) : (
                                    <span 
                                      className="cursor-pointer hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                                      onClick={() => handleTimeClick(employee.userId, idx, segment.id, 'startTime', segment.startTime)}
                                      title="Click pentru a edita ora de start"
                                    >
                                      {formatRomania(segment.startTime, 'HH:mm')}
                                    </span>
                                  )}
                                  
                                  <span>→</span>
                                  
                                  {isEditingEnd ? (
                                    <Input
                                      type="time"
                                      value={editingSegment.value}
                                      onChange={(e) => handleTimeChange(e.target.value)}
                                      onBlur={() => handleTimeSave(employee)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTimeSave(employee);
                                        if (e.key === 'Escape') handleTimeCancel();
                                      }}
                                      autoFocus
                                      className="w-24 h-7 text-xs"
                                    />
                                  ) : (
                                    <span 
                                      className="cursor-pointer hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                                      onClick={() => handleTimeClick(employee.userId, idx, segment.id, 'endTime', segment.endTime)}
                                      title="Click pentru a edita ora de final"
                                    >
                                      {formatRomania(segment.endTime, 'HH:mm')}
                                    </span>
                                  )}
                                </div>
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
                            <p>Modifică orele și recalculează automat</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(employee.entries[0])}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Șterge
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Șterge pontajul complet</p>
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
            // ✅ FIX: Nu schimbăm automat echipa - user rămâne pe pagina curentă
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              toast({
                title: '✅ Pontaj editat și aprobat',
                description: 'Modificările au fost salvate cu succes.',
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
            // ✅ FIX: Nu schimbăm automat echipa - user rămâne pe pagina curentă
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              toast({
                title: '✅ Pontaj șters',
                description: 'Pontajul a fost șters cu succes.',
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

      <BulkClockTimeEditDialog
        open={bulkClockEditDialogOpen}
        onOpenChange={setBulkClockEditDialogOpen}
        groupedByEmployee={groupedByEmployeeMap}
        dailyTimesheets={dailyTimesheets}
        selectedDate={selectedDate!}
      />
    </>
  );
};

