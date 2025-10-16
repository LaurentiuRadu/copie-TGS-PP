import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, RotateCcw, X, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface TimeEntryApprovalEditDialogProps {
  entry: {
    id: string;
    user_id: string;
    clock_in_time: string;
    clock_out_time: string | null;
    profiles: {
      full_name: string;
      username: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TimeEntryApprovalEditDialog({
  entry,
  open,
  onOpenChange,
  onSuccess,
}: TimeEntryApprovalEditDialogProps) {
  const [clockIn, setClockIn] = useState(
    format(new Date(entry.clock_in_time), "yyyy-MM-dd'T'HH:mm")
  );
  const [clockOut, setClockOut] = useState(
    entry.clock_out_time 
      ? format(new Date(entry.clock_out_time), "yyyy-MM-dd'T'HH:mm")
      : ""
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // State pentru segmentare manuală
  const [manualSegmentation, setManualSegmentation] = useState(false);
  
  // State pentru confirmare propagare pasageri
  const [showPassengerConfirm, setShowPassengerConfirm] = useState(false);
  const [otherPassengers, setOtherPassengers] = useState<Array<{
    user_id: string;
    full_name: string;
    entry_id: string;
  }>>([]);
  
  // Refactor: Draft pentru UI (string) + Parsed pentru calcule/salvare
  const [manualHoursDraft, setManualHoursDraft] = useState({
    hours_regular: '',
    hours_night: '',
    hours_saturday: '',
    hours_sunday: '',
    hours_holiday: '',
    hours_passenger: '',
    hours_driving: '',
    hours_equipment: '',
  });

  // Parsează draft-ul pentru calcule
  const manualHoursParsed = useMemo(() => {
    const parsed: Record<string, number> = {};
    Object.entries(manualHoursDraft).forEach(([key, value]) => {
      const cleaned = value.replace(',', '.');
      const num = parseFloat(cleaned);
      parsed[key] = isNaN(num) || num < 0 ? 0 : parseFloat(num.toFixed(2));
    });
    return parsed;
  }, [manualHoursDraft]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Detectează dacă entry-ul curent este pentru pasager
  const isPassengerEntry = useQuery({
    queryKey: ['is-passenger', entry.id],
    queryFn: async () => {
      const workDate = format(new Date(entry.clock_in_time), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('daily_timesheets')
        .select('hours_passenger')
        .eq('employee_id', entry.user_id)
        .eq('work_date', workDate)
        .single();
      
      return (data?.hours_passenger || 0) > 0;
    },
    enabled: open,
  });

  // Găsește alți pasageri din aceeași echipă și vehicul
  const findOtherPassengers = async () => {
    const workDate = format(new Date(entry.clock_in_time), 'yyyy-MM-dd');
    const dayOfWeek = new Date(entry.clock_in_time).getDay();
    
    // Găsește echipa și vehiculul angajatului curent
    const { data: currentSchedule } = await supabase
      .from('weekly_schedules')
      .select('team_id, vehicle, week_start_date')
      .eq('user_id', entry.user_id)
      .lte('week_start_date', workDate)
      .gte('week_start_date', format(new Date(new Date(workDate).getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
      .eq('day_of_week', dayOfWeek)
      .single();

    if (!currentSchedule?.team_id || !currentSchedule?.vehicle) {
      return [];
    }

    // Găsește toți membrii echipei cu același vehicul
    const { data: teamMembers } = await supabase
      .from('weekly_schedules')
      .select('user_id, profiles(full_name)')
      .eq('team_id', currentSchedule.team_id)
      .eq('vehicle', currentSchedule.vehicle)
      .eq('week_start_date', currentSchedule.week_start_date)
      .eq('day_of_week', dayOfWeek)
      .neq('user_id', entry.user_id);

    if (!teamMembers || teamMembers.length === 0) {
      return [];
    }

    // Verifică care au hours_passenger > 0
    const { data: passengerTimesheets } = await supabase
      .from('daily_timesheets')
      .select('employee_id, hours_passenger')
      .eq('work_date', workDate)
      .in('employee_id', teamMembers.map(m => m.user_id))
      .gt('hours_passenger', 0);

    if (!passengerTimesheets || passengerTimesheets.length === 0) {
      return [];
    }

    // Găsește time_entries pentru acești pasageri
    const { data: passengerEntries } = await supabase
      .from('time_entries')
      .select('id, user_id')
      .in('user_id', passengerTimesheets.map(p => p.employee_id))
      .gte('clock_in_time', workDate)
      .lt('clock_in_time', format(new Date(new Date(workDate).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

    return teamMembers
      .filter(member => {
        const hasPassengerHours = passengerTimesheets.some(p => p.employee_id === member.user_id);
        const hasEntry = passengerEntries?.some(e => e.user_id === member.user_id);
        return hasPassengerHours && hasEntry;
      })
      .map(member => ({
        user_id: member.user_id,
        full_name: (member.profiles as any)?.full_name || 'Necunoscut',
        entry_id: passengerEntries?.find(e => e.user_id === member.user_id)?.id || '',
      }));
  };

  // Calculează total ore din pontaj
  const totalHours = useMemo(() => {
    if (!clockIn || !clockOut) return 0;
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return parseFloat(hours.toFixed(2));
  }, [clockIn, clockOut]);

  // Calculează ore alocate manual (folosim parsed)
  const allocatedHours = useMemo(() => {
    return Object.values(manualHoursParsed).reduce((sum, val) => sum + val, 0);
  }, [manualHoursParsed]);

  // Calculează ore rămase
  const remainingHours = useMemo(() => {
    return parseFloat((totalHours - allocatedHours).toFixed(2));
  }, [totalHours, allocatedHours]);

  // Whitelist utilizatori cu acces la ore echipament
  const hasEquipmentAccess = useMemo(() => {
    const equipmentUsers = ['Ababei', 'Costache Marius', 'Rusu Gheorghita'];
    return equipmentUsers.some(name => 
      entry.profiles.full_name?.includes(name)
    );
  }, [entry.profiles.full_name]);

  // Funcții helper pentru segmentare manuală
  const allocateMax = (field: keyof typeof manualHoursDraft) => {
    if (remainingHours <= 0) return;
    
    const currentParsed = manualHoursParsed[field] || 0;
    const newValue = parseFloat((currentParsed + remainingHours).toFixed(2));
    
    setManualHoursDraft(prev => ({
      ...prev,
      [field]: newValue.toString()
    }));
  };

  const resetField = (field: keyof typeof manualHoursDraft) => {
    setManualHoursDraft(prev => ({ ...prev, [field]: '0' }));
  };

  const resetAllFields = () => {
    setManualHoursDraft({
      hours_regular: '0',
      hours_night: '0',
      hours_saturday: '0',
      hours_sunday: '0',
      hours_holiday: '0',
      hours_passenger: '0',
      hours_driving: '0',
      hours_equipment: '0',
    });
  };

  const validateDuration = () => {
    if (!clockOut) {
      return "Clock-out lipsește";
    }
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (durationHours <= 0) {
      return "Clock-out trebuie să fie după clock-in";
    }
    if (durationHours > 24) {
      return "Durată maximă: 24 ore";
    }
    return null;
  };

  const validateManualSegmentation = (): string | null => {
    if (!manualSegmentation) return null;
    
    // Permite override: doar verifică că există ore alocate
    if (allocatedHours <= 0) {
      return `❌ Trebuie să aloci cel puțin 1 oră!`;
    }
    
    // Warning în consolă pentru override detection (prag redus la 0.01h = 36 secunde)
    if (Math.abs(totalHours - allocatedHours) > 0.01) {
      console.warn('[OVERRIDE MANUAL] Total calculat:', totalHours, 'h | Total manual:', allocatedHours, 'h');
    }
    
    return null;
  };

  const updateAndApprove = useMutation({
    mutationFn: async ({ applyToAll = false }: { applyToAll?: boolean } = {}) => {
      // Verifică dacă pontajul este invalid (< 10 min)
      if (clockOut) {
        const duration = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
        if (duration < 0.17) { // ✅ 10 min = 0.167h
          toast({
            title: "⚠️ Pontaj Invalid",
            description: `Pontajele cu durata < 10 min trebuie șterse, nu aprobate. (Durata: ${Math.round(duration * 60)} min)`,
            variant: "destructive",
          });
          throw new Error(`Pontaj invalid: ${Math.round(duration * 60)} min (minim 10 min)`);
        }
      }

      const validationError = validateDuration();
      if (validationError) {
        throw new Error(validationError);
      }

      // Fetch current entry to check if already has originals
      const { data: currentEntry } = await supabase
        .from('time_entries')
        .select('original_clock_in_time, original_clock_out_time, clock_in_time, clock_out_time')
        .eq('id', entry.id)
        .single();

      // Dacă segmentare manuală, salvează direct în daily_timesheets (folosim parsed)
      if (manualSegmentation) {
        const workDate = format(new Date(clockIn), 'yyyy-MM-dd');
        
        // Detectează override (prag redus la 0.01h = 36 secunde)
        const isOverride = Math.abs(totalHours - allocatedHours) > 0.01;
        const overrideNote = isOverride 
          ? `[OVERRIDE MANUAL: ${allocatedHours.toFixed(2)}h din ${totalHours.toFixed(2)}h calculate] ` 
          : '[SEGMENTARE MANUALĂ] ';
        
        const { error: timesheetError } = await supabase
          .from('daily_timesheets')
          .upsert({
            employee_id: entry.user_id,
            work_date: workDate,
            hours_regular: manualHoursParsed.hours_regular,
            hours_night: manualHoursParsed.hours_night,
            hours_saturday: manualHoursParsed.hours_saturday,
            hours_sunday: manualHoursParsed.hours_sunday,
            hours_holiday: manualHoursParsed.hours_holiday,
            hours_passenger: manualHoursParsed.hours_passenger,
            hours_driving: manualHoursParsed.hours_driving,
            hours_equipment: manualHoursParsed.hours_equipment,
            hours_leave: 0,
            hours_medical_leave: 0,
            notes: `${overrideNote}${adminNotes || 'Repartizare corectată manual'}`,
          }, {
            onConflict: 'employee_id,work_date'
          });

        if (timesheetError) throw timesheetError;
      }

      // Prepare update data
      const updateData: any = {
        clock_in_time: new Date(clockIn).toISOString(),
        clock_out_time: new Date(clockOut).toISOString(),
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approval_notes: manualSegmentation 
          ? `[SEGMENTARE MANUALĂ] ${adminNotes}` 
          : (adminNotes || null),
        needs_reprocessing: !manualSegmentation, // Skip reprocess dacă manual
        was_edited_by_admin: true,
      };

      // Set originals only if not already set (first edit)
      if (currentEntry && !currentEntry.original_clock_in_time) {
        updateData.original_clock_in_time = currentEntry.clock_in_time;
      }
      if (currentEntry && !currentEntry.original_clock_out_time) {
        updateData.original_clock_out_time = currentEntry.clock_out_time;
      }

      // Update time entry and auto-approve
      const { error: updateError } = await supabase
        .from('time_entries')
        .update(updateData)
        .eq('id', entry.id);

      if (updateError) throw updateError;

      // Aplică modificările la alți pasageri dacă este cazul
      if (applyToAll && otherPassengers.length > 0) {
        const workDate = format(new Date(clockIn), 'yyyy-MM-dd');
        
        for (const passenger of otherPassengers) {
          // Update time_entry pentru fiecare pasager
          const { data: passengerEntry } = await supabase
            .from('time_entries')
            .select('original_clock_in_time, original_clock_out_time, clock_in_time, clock_out_time')
            .eq('id', passenger.entry_id)
            .single();

          const passengerUpdateData: any = {
            clock_in_time: new Date(clockIn).toISOString(),
            clock_out_time: new Date(clockOut).toISOString(),
            approval_status: 'approved',
            approved_at: new Date().toISOString(),
            approval_notes: `[AUTO-SINCRONIZAT CU ${entry.profiles.full_name}] ${adminNotes}`,
            needs_reprocessing: !manualSegmentation,
            was_edited_by_admin: true,
          };

          if (passengerEntry && !passengerEntry.original_clock_in_time) {
            passengerUpdateData.original_clock_in_time = passengerEntry.clock_in_time;
          }
          if (passengerEntry && !passengerEntry.original_clock_out_time) {
            passengerUpdateData.original_clock_out_time = passengerEntry.clock_out_time;
          }

          await supabase
            .from('time_entries')
            .update(passengerUpdateData)
            .eq('id', passenger.entry_id);

          // Update daily_timesheets dacă e segmentare manuală
          if (manualSegmentation) {
            await supabase
              .from('daily_timesheets')
              .update({
                hours_passenger: manualHoursParsed.hours_passenger,
                notes: `[AUTO-SINCRONIZAT] ${adminNotes || 'Sincronizat cu echipa'}`,
                updated_at: new Date().toISOString(),
              })
              .eq('employee_id', passenger.user_id)
              .eq('work_date', workDate);
          } else {
            // Trigger recalculation pentru fiecare pasager
            await supabase.functions.invoke('calculate-time-segments', {
              body: {
                user_id: passenger.user_id,
                time_entry_id: passenger.entry_id,
                clock_in_time: new Date(clockIn).toISOString(),
                clock_out_time: new Date(clockOut).toISOString(),
              },
            });
          }
        }
      }

      // Trigger recalculation DOAR dacă nu e segmentare manuală pentru entry-ul principal
      if (!manualSegmentation && !applyToAll) {
        const { error: functionError } = await supabase.functions.invoke('calculate-time-segments', {
          body: {
            user_id: entry.user_id,
            time_entry_id: entry.id,
            clock_in_time: new Date(clockIn).toISOString(),
            clock_out_time: new Date(clockOut).toISOString(),
          },
        });

        if (functionError) {
          console.warn('[Approval Edit] Recalculation warning:', functionError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'daily-timesheets-for-approval'
      });
      
      const appliedCount = otherPassengers.length > 0 ? otherPassengers.length + 1 : 1;
      
      toast({
        title: "✅ Pontaj corectat și aprobat",
        description: otherPassengers.length > 0 
          ? `Modificările au fost aplicate la ${appliedCount} pasageri din echipă.`
          : manualSegmentation 
            ? "Orele au fost repartizate manual cu succes." 
            : "Modificările au fost salvate și pontajul a fost aprobat automat.",
      });
      
      setShowPassengerConfirm(false);
      setOtherPassengers([]);
      onOpenChange(false);
      
      // Trigger auto-scroll callback
      onSuccess?.();
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        variant: "destructive",
        title: "❌ Eroare",
        description: error.message,
      });
    },
  });

  const handleSave = async () => {
    setError(null);
    
    const validationError = validateDuration();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    const segmentationError = validateManualSegmentation();
    if (segmentationError) {
      setError(segmentationError);
      return;
    }
    
    // Validare: adminNotes obligatorii când există override (prag redus la 0.01h = 36 secunde)
    if (manualSegmentation && Math.abs(totalHours - allocatedHours) > 0.01) {
      if (!adminNotes.trim()) {
        setError('❌ Când modifici totalul de ore, trebuie să explici motivul în "Note Admin"!');
        toast({
          variant: "destructive",
          title: "Note obligatorii",
          description: "Explică de ce modifici totalul de ore (ex: pontaj greșit, corecție solicitată, etc.)",
        });
        return;
      }
    }
    
    // Verifică dacă este pasager și dacă există alți pasageri în echipă
    if (isPassengerEntry.data) {
      const passengers = await findOtherPassengers();
      if (passengers.length > 0) {
        setOtherPassengers(passengers);
        setShowPassengerConfirm(true);
        return;
      }
    }
    
    updateAndApprove.mutate({ applyToAll: false });
  };

  const calculateDuration = () => {
    if (!clockOut) return '0';
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours > 0 ? hours.toFixed(1) : '0';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
      <DialogHeader>
        <DialogTitle>✏️ Editare și Aprobare Pontaj</DialogTitle>
        <DialogDescription>
          {entry.profiles.full_name} ({entry.profiles.username})
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[calc(100vh-240px)] pr-4">
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="clock-in">Clock-In</Label>
            <Input
              id="clock-in"
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clock-out">Clock-Out</Label>
            <Input
              id="clock-out"
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Durată nouă: <strong>{calculateDuration()} ore</strong>
              {parseFloat(calculateDuration()) > 24 && (
                <span className="text-destructive"> (prea lung!)</span>
              )}
            </AlertDescription>
          </Alert>

          {/* Toggle Segmentare Manuală */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <div>
              <Label className="text-sm font-medium">🛠️ Segmentare Manuală Ore</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Repartizează orele manual (pentru pontaje greșite)
              </p>
            </div>
            <Switch
              checked={manualSegmentation}
              onCheckedChange={(checked) => {
                setManualSegmentation(checked);
                if (!checked) resetAllFields();
              }}
            />
          </div>

          {/* Form Segmentare Manuală */}
          {manualSegmentation && (
            <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
              {/* Header: Total, Repartizate, Rămase */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-card rounded-lg border">
                <div>
                  <p className="text-xs text-muted-foreground">Total Pontaj</p>
                  <p className="text-lg font-bold">{totalHours.toFixed(2)}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Repartizate</p>
                  <p className="text-lg font-bold text-blue-600">
                    {allocatedHours.toFixed(2)}h
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rămase</p>
                  <p className={`text-lg font-bold ${
                    remainingHours > 0 ? 'text-orange-600' : 
                    remainingHours < 0 ? 'text-red-600' : 
                    'text-green-600'
                  }`}>
                    {remainingHours.toFixed(2)}h
                  </p>
                </div>
              </div>

              {/* Warning Override Manual (prag redus la 0.01h = 36 secunde) */}
              {Math.abs(totalHours - allocatedHours) > 0.01 && allocatedHours > 0 && (
                <Alert className="bg-orange-50 dark:bg-orange-950/20 border-orange-400">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold text-orange-800 dark:text-orange-300">
                        ⚠️ OVERRIDE MANUAL ACTIV
                      </p>
                      <p className="text-sm">
                        • Total calculat din pontaj: <strong>{totalHours.toFixed(2)}h</strong><br/>
                        • Total segmentat manual: <strong>{allocatedHours.toFixed(2)}h</strong><br/>
                        • Diferență: <strong className={allocatedHours > totalHours ? 'text-green-600' : 'text-red-600'}>
                          {allocatedHours > totalHours ? '+' : ''}{(allocatedHours - totalHours).toFixed(2)}h
                        </strong>
                      </p>
                      <p className="text-sm font-semibold mt-2 text-orange-900 dark:text-orange-200">
                        🔔 Angajatul va vedea {allocatedHours.toFixed(2)}h (nu {totalHours.toFixed(2)}h) în aplicație!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Motivul override-ului trebuie explicat în "Note Admin" mai jos.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Alert Status Normal (prag redus la 0.01h = 36 secunde) */}
              {Math.abs(totalHours - allocatedHours) <= 0.01 && allocatedHours > 0 && (
                <Alert className="bg-green-50 dark:bg-green-950/20 border-green-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    ✅ Total repartizat corect! ({totalHours.toFixed(2)}h)
                  </AlertDescription>
                </Alert>
              )}

              {/* Buton Reset Global */}
              <div className="flex justify-end">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={resetAllFields}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Toate
                </Button>
              </div>

              {/* Câmpuri Individuale */}
              <div className="space-y-2">
                {([
                  { key: 'hours_regular' as const, label: '📅 Ore Normale' },
                  { key: 'hours_night' as const, label: '🌙 Ore Noapte' },
                  { key: 'hours_saturday' as const, label: '🛡️ Ore Sâmbătă' },
                  { key: 'hours_sunday' as const, label: '🛡️ Ore Duminică' },
                  { key: 'hours_holiday' as const, label: '🎉 Ore Sărbătoare' },
                  { key: 'hours_passenger' as const, label: '👥 Ore Pasager' },
                  { key: 'hours_driving' as const, label: '🚗 Ore Conducere' },
                  ...(hasEquipmentAccess ? [{ key: 'hours_equipment' as const, label: '⚙️ Ore Echipament' }] : [])
                 ] as Array<{ key: keyof typeof manualHoursDraft; label: string }>).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="text-sm font-medium w-40">
                      {label}
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      placeholder="0.00"
                      value={manualHoursDraft[key]}
                      onChange={(e) => {
                        // Permite tastare directă, inclusiv ștergere a lui "0"
                        const value = e.target.value;
                        setManualHoursDraft(prev => ({
                          ...prev,
                          [key]: value
                        }));
                      }}
                      onBlur={(e) => {
                        // La blur: parsează, validează, rotunjește
                        const value = e.target.value.replace(',', '.');
                        const num = parseFloat(value);
                        const final = isNaN(num) || num < 0 ? 0 : parseFloat(num.toFixed(2));
                        setManualHoursDraft(prev => ({
                          ...prev,
                          [key]: final.toFixed(2)
                        }));
                      }}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">ore</span>
                    <div className="flex gap-1 ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => allocateMax(key)}
                        disabled={remainingHours <= 0}
                        title="Alocă tot restul aici"
                      >
                        Max
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetField(key)}
                        disabled={manualHoursParsed[key] === 0}
                        title="Reset la 0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-notes">Admin Notes (opțional)</Label>
            <Textarea
              id="admin-notes"
              placeholder="Motivul corectării..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={
              updateAndApprove.isPending || 
              !!validateDuration()
            }
          >
            {updateAndApprove.isPending ? "Salvez..." : "Salvează și Aprobă"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog confirmare propagare la alți pasageri */}
    <AlertDialog open={showPassengerConfirm} onOpenChange={setShowPassengerConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Sincronizare Pasageri din Echipă
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              <strong>{entry.profiles.full_name}</strong> este pasager și face parte dintr-o echipă cu încă <strong>{otherPassengers.length} {otherPassengers.length === 1 ? 'pasager' : 'pasageri'}</strong>:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              {otherPassengers.map((passenger) => (
                <div key={passenger.user_id} className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{passenger.full_name}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium">
              Vrei să aplici aceleași modificări de orar (intrare/ieșire) la toți pasagerii din echipă?
            </p>
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-300">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm">
                Pasagerii din aceeași echipă și vehicul trebuie să aibă aceleași ore de intrare/ieșire.
              </AlertDescription>
            </Alert>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setShowPassengerConfirm(false);
            updateAndApprove.mutate({ applyToAll: false });
          }}>
            Nu, doar {entry.profiles.full_name}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              updateAndApprove.mutate({ applyToAll: true });
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Da, sincronizează toată echipa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
