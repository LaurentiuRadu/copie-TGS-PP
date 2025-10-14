import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, RotateCcw, X } from "lucide-react";
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
}

export function TimeEntryApprovalEditDialog({
  entry,
  open,
  onOpenChange,
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
  const [manualHours, setManualHours] = useState({
    hours_regular: 0,
    hours_night: 0,
    hours_saturday: 0,
    hours_sunday: 0,
    hours_holiday: 0,
    hours_passenger: 0,
    hours_driving: 0,
    hours_equipment: 0,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculează total ore din pontaj
  const totalHours = useMemo(() => {
    if (!clockIn || !clockOut) return 0;
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return parseFloat(hours.toFixed(2));
  }, [clockIn, clockOut]);

  // Calculează ore alocate manual
  const allocatedHours = useMemo(() => {
    return Object.values(manualHours).reduce((sum, val) => sum + parseFloat(val.toString()), 0);
  }, [manualHours]);

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
  const allocateMax = (field: keyof typeof manualHours) => {
    if (remainingHours <= 0) return;
    
    setManualHours(prev => ({
      ...prev,
      [field]: parseFloat((prev[field] + remainingHours).toFixed(2))
    }));
  };

  const resetField = (field: keyof typeof manualHours) => {
    setManualHours(prev => ({ ...prev, [field]: 0 }));
  };

  const resetAllFields = () => {
    setManualHours({
      hours_regular: 0,
      hours_night: 0,
      hours_saturday: 0,
      hours_sunday: 0,
      hours_holiday: 0,
      hours_passenger: 0,
      hours_driving: 0,
      hours_equipment: 0,
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
    
    if (Math.abs(remainingHours) > 0.01) {
      if (remainingHours > 0) {
        return `❌ Mai rămân ${remainingHours.toFixed(2)}h nerepartizate! Alocă-le înainte de salvare.`;
      } else {
        return `❌ Ai depășit totalul cu ${Math.abs(remainingHours).toFixed(2)}h! Reduce orele alocate.`;
      }
    }
    
    return null;
  };

  const updateAndApprove = useMutation({
    mutationFn: async () => {
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

      // Dacă segmentare manuală, salvează direct în daily_timesheets
      if (manualSegmentation) {
        const workDate = format(new Date(clockIn), 'yyyy-MM-dd');
        
        const { error: timesheetError } = await supabase
          .from('daily_timesheets')
          .upsert({
            employee_id: entry.user_id,
            work_date: workDate,
            hours_regular: manualHours.hours_regular,
            hours_night: manualHours.hours_night,
            hours_saturday: manualHours.hours_saturday,
            hours_sunday: manualHours.hours_sunday,
            hours_holiday: manualHours.hours_holiday,
            hours_passenger: manualHours.hours_passenger,
            hours_driving: manualHours.hours_driving,
            hours_equipment: manualHours.hours_equipment,
            hours_leave: 0,
            hours_medical_leave: 0,
            notes: `[SEGMENTARE MANUALĂ ADMIN] ${adminNotes || 'Repartizare corectată manual'}`,
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

      // Trigger recalculation DOAR dacă nu e segmentare manuală
      if (!manualSegmentation) {
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
      
      toast({
        title: "✅ Pontaj corectat și aprobat",
        description: manualSegmentation 
          ? "Orele au fost repartizate manual cu succes." 
          : "Modificările au fost salvate și pontajul a fost aprobat automat.",
      });
      onOpenChange(false);
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

  const handleSave = () => {
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
    
    updateAndApprove.mutate();
  };

  const calculateDuration = () => {
    if (!clockOut) return '0';
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours > 0 ? hours.toFixed(1) : '0';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>✏️ Editare și Aprobare Pontaj</DialogTitle>
          <DialogDescription>
            {entry.profiles.full_name} ({entry.profiles.username})
          </DialogDescription>
        </DialogHeader>

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

              {/* Alert Status */}
              {remainingHours !== 0 && (
                <Alert variant={remainingHours > 0 ? 'default' : 'destructive'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {remainingHours > 0 
                      ? `⚠️ Rămân ${remainingHours.toFixed(2)}h nerepartizate! Nu poți salva până nu aloci tot.` 
                      : `❌ Ai depășit totalul cu ${Math.abs(remainingHours).toFixed(2)}h! Reduce orele alocate.`
                    }
                  </AlertDescription>
                </Alert>
              )}

              {remainingHours === 0 && allocatedHours > 0 && (
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
                ] as Array<{ key: keyof typeof manualHours; label: string }>).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="text-sm font-medium w-40">
                      {label}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalHours}
                      value={manualHours[key]}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        const cappedValue = Math.min(value, totalHours);
                        setManualHours(prev => ({
                          ...prev,
                          [key]: parseFloat(cappedValue.toFixed(2))
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
                        disabled={manualHours[key] === 0}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={
              updateAndApprove.isPending || 
              !!validateDuration() ||
              (manualSegmentation && Math.abs(remainingHours) > 0.01)
            }
          >
            {updateAndApprove.isPending ? "Salvez..." : "Salvează și Aprobă"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
