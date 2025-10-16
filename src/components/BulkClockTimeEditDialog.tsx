import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse, isAfter, differenceInHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmployeeData {
  userId: string;
  userName: string;
  entries: Array<{
    id: string;
    clock_in_time: string;
    clock_out_time: string | null;
  }>;
}

interface DailyTimesheet {
  employee_id: string;
  hours_regular?: number;
  hours_driving?: number;
  hours_passenger?: number;
  hours_equipment?: number;
}

interface BulkClockTimeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedByEmployee: Map<string, EmployeeData>;
  dailyTimesheets: DailyTimesheet[];
  selectedDate: Date;
}

interface BulkUpdatePayload {
  timeEntryId: string;
  clockIn: string;
  clockOut: string;
  userId: string;
  userName: string;
}

export function BulkClockTimeEditDialog({
  open,
  onOpenChange,
  groupedByEmployee,
  dailyTimesheets,
  selectedDate,
}: BulkClockTimeEditDialogProps) {
  const queryClient = useQueryClient();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'normal' | 'drivers'>('normal');
  
  // Normal employees state
  const [normalClockIn, setNormalClockIn] = useState('07:00');
  const [normalClockOut, setNormalClockOut] = useState('18:00');
  const [applyToNormal, setApplyToNormal] = useState(true);
  
  // Drivers state
  const [drivingClockIn, setDrivingClockIn] = useState('07:00');
  const [drivingClockOut, setDrivingClockOut] = useState('18:00');
  const [applyToDriving, setApplyToDriving] = useState(true);
  
  const [passengerClockIn, setPassengerClockIn] = useState('07:00');
  const [passengerClockOut, setPassengerClockOut] = useState('18:00');
  const [applyToPassenger, setApplyToPassenger] = useState(true);
  
  const [equipmentClockIn, setEquipmentClockIn] = useState('07:00');
  const [equipmentClockOut, setEquipmentClockOut] = useState('18:00');
  const [applyToEquipment, setApplyToEquipment] = useState(true);

  // Create dailyByUser map
  const dailyByUser = useMemo(() => {
    const map = new Map<string, DailyTimesheet>();
    dailyTimesheets.forEach(daily => {
      map.set(daily.employee_id, daily);
    });
    return map;
  }, [dailyTimesheets]);

  // Detect normal employees (only hours_regular, no special hours)
  const normalEmployees = useMemo(() => {
    return Array.from(groupedByEmployee.values()).filter(emp => {
      const daily = dailyByUser.get(emp.userId);
      if (!daily) return false;
      
      const hasNormalHours = (daily.hours_regular || 0) > 0;
      const hasSpecialHours = (daily.hours_driving || 0) > 0 || 
                              (daily.hours_passenger || 0) > 0 || 
                              (daily.hours_equipment || 0) > 0;
      
      return hasNormalHours && !hasSpecialHours;
    });
  }, [groupedByEmployee, dailyByUser]);

  // Detect drivers with special hours
  const driversWithHours = useMemo(() => {
    return Array.from(groupedByEmployee.values())
      .filter(emp => {
        const daily = dailyByUser.get(emp.userId);
        if (!daily) return false;
        
        return (daily.hours_driving || 0) > 0 || 
               (daily.hours_passenger || 0) > 0 || 
               (daily.hours_equipment || 0) > 0;
      })
      .map(emp => {
        const daily = dailyByUser.get(emp.userId)!;
        return {
          ...emp,
          hasDriving: (daily.hours_driving || 0) > 0,
          hasPassenger: (daily.hours_passenger || 0) > 0,
          hasEquipment: (daily.hours_equipment || 0) > 0,
        };
      });
  }, [groupedByEmployee, dailyByUser]);

  // Validate time input
  const validateTimes = (clockIn: string, clockOut: string): { valid: boolean; error?: string } => {
    try {
      const inTime = parse(clockIn, 'HH:mm', selectedDate);
      const outTime = parse(clockOut, 'HH:mm', selectedDate);
      
      if (!isAfter(outTime, inTime)) {
        return { valid: false, error: 'Clock Out trebuie să fie după Clock In' };
      }
      
      const hours = differenceInHours(outTime, inTime);
      if (hours < 1 || hours > 24) {
        return { valid: false, error: 'Intervalul trebuie să fie între 1 și 24 ore' };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, error: 'Format oră invalid (folosește HH:mm)' };
    }
  };

  // Build updates for normal employees
  const normalUpdates = useMemo((): BulkUpdatePayload[] => {
    if (!applyToNormal) return [];
    
    const validation = validateTimes(normalClockIn, normalClockOut);
    if (!validation.valid) return [];
    
    const updates: BulkUpdatePayload[] = [];
    normalEmployees.forEach(emp => {
      emp.entries.forEach(entry => {
        if (entry.clock_out_time) {
          const clockIn = format(parse(normalClockIn, 'HH:mm', selectedDate), "yyyy-MM-dd'T'HH:mm:ssXXX");
          const clockOut = format(parse(normalClockOut, 'HH:mm', selectedDate), "yyyy-MM-dd'T'HH:mm:ssXXX");
          
          updates.push({
            timeEntryId: entry.id,
            clockIn,
            clockOut,
            userId: emp.userId,
            userName: emp.userName,
          });
        }
      });
    });
    
    return updates;
  }, [applyToNormal, normalClockIn, normalClockOut, normalEmployees, selectedDate]);

  // Build updates for drivers
  const driverUpdates = useMemo((): BulkUpdatePayload[] => {
    const updates: BulkUpdatePayload[] = [];
    
    driversWithHours.forEach(emp => {
      // Determine which times to apply based on what they have
      let clockIn = '';
      let clockOut = '';
      
      if (applyToDriving && emp.hasDriving) {
        const validation = validateTimes(drivingClockIn, drivingClockOut);
        if (validation.valid) {
          clockIn = drivingClockIn;
          clockOut = drivingClockOut;
        }
      } else if (applyToPassenger && emp.hasPassenger) {
        const validation = validateTimes(passengerClockIn, passengerClockOut);
        if (validation.valid) {
          clockIn = passengerClockIn;
          clockOut = passengerClockOut;
        }
      } else if (applyToEquipment && emp.hasEquipment) {
        const validation = validateTimes(equipmentClockIn, equipmentClockOut);
        if (validation.valid) {
          clockIn = equipmentClockIn;
          clockOut = equipmentClockOut;
        }
      }
      
      if (clockIn && clockOut) {
        emp.entries.forEach(entry => {
          if (entry.clock_out_time) {
            const formattedClockIn = format(parse(clockIn, 'HH:mm', selectedDate), "yyyy-MM-dd'T'HH:mm:ssXXX");
            const formattedClockOut = format(parse(clockOut, 'HH:mm', selectedDate), "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            updates.push({
              timeEntryId: entry.id,
              clockIn: formattedClockIn,
              clockOut: formattedClockOut,
              userId: emp.userId,
              userName: emp.userName,
            });
          }
        });
      }
    });
    
    return updates;
  }, [
    applyToDriving, drivingClockIn, drivingClockOut,
    applyToPassenger, passengerClockIn, passengerClockOut,
    applyToEquipment, equipmentClockIn, equipmentClockOut,
    driversWithHours, selectedDate
  ]);

  const totalUpdates = activeTab === 'normal' ? normalUpdates : driverUpdates;

  // Mutation for bulk update
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: BulkUpdatePayload[]) => {
      console.log('[BulkEdit] Updating', updates.length, 'time entries');
      
      // 1. Update time_entries
      const updatePromises = updates.map(update =>
        supabase
          .from('time_entries')
          .update({
            clock_in_time: update.clockIn,
            clock_out_time: update.clockOut,
            approval_notes: `[EDITARE COLECTIVĂ] Clock In/Out ajustate de admin la ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
          })
          .eq('id', update.timeEntryId)
      );
      
      const results = await Promise.all(updatePromises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} entries`);
      }
      
      // 2. Trigger recalculation for each entry
      const recalcPromises = updates.map(update =>
        supabase.functions.invoke('calculate-time-segments', {
          body: {
            time_entry_id: update.timeEntryId,
            clock_in_time: update.clockIn,
            clock_out_time: update.clockOut,
            user_id: update.userId,
          }
        })
      );
      
      await Promise.all(recalcPromises);
      
      console.log('[BulkEdit] ✅ Successfully updated and recalculated', updates.length, 'entries');
    },
    onSuccess: () => {
      toast.success(`${totalUpdates.length} pontaje actualizate cu succes`);
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === 'team-pending-approvals' ||
        query.queryKey[0] === 'daily-timesheets-for-approval'
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('[BulkEdit] Error:', error);
      toast.error(`Eroare la actualizare: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (totalUpdates.length === 0) {
      toast.error('Nu există pontaje de actualizat');
      return;
    }
    
    bulkUpdateMutation.mutate(totalUpdates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Editare Colectivă Clock In/Out
          </DialogTitle>
          <DialogDescription>
            Ajustează orele de pontaj pentru toți angajații din echipă deodată
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'normal' | 'drivers')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="normal">
              Ore Normale ({normalEmployees.length})
            </TabsTrigger>
            <TabsTrigger value="drivers">
              Șoferi ({driversWithHours.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="normal" className="space-y-4 mt-4">
            {normalEmployees.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nu există angajați cu ore normale în această zi.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="normal-clock-in">Clock In</Label>
                    <Input
                      id="normal-clock-in"
                      type="time"
                      value={normalClockIn}
                      onChange={(e) => setNormalClockIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="normal-clock-out">Clock Out</Label>
                    <Input
                      id="normal-clock-out"
                      type="time"
                      value={normalClockOut}
                      onChange={(e) => setNormalClockOut(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="apply-normal"
                    checked={applyToNormal}
                    onCheckedChange={(checked) => setApplyToNormal(checked as boolean)}
                  />
                  <label htmlFor="apply-normal" className="text-sm font-medium">
                    Aplică la toți angajații cu ore normale
                  </label>
                </div>

                {(() => {
                  const validation = validateTimes(normalClockIn, normalClockOut);
                  if (!validation.valid) {
                    return (
                      <Alert variant="destructive">
                        <AlertDescription>{validation.error}</AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}

                <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <h4 className="font-semibold mb-2">Preview ({normalUpdates.length} pontaje):</h4>
                  <div className="space-y-1 text-sm">
                    {normalUpdates.map((update, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{update.userName}</span>
                        <span className="text-muted-foreground">
                          {normalClockIn} → {normalClockOut}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4 mt-4">
            {driversWithHours.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nu există șoferi cu ore speciale în această zi.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Driving section */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">🚗 Condus</h4>
                    <Checkbox
                      id="apply-driving"
                      checked={applyToDriving}
                      onCheckedChange={(checked) => setApplyToDriving(checked as boolean)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Clock In Condus</Label>
                      <Input
                        type="time"
                        value={drivingClockIn}
                        onChange={(e) => setDrivingClockIn(e.target.value)}
                        disabled={!applyToDriving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Clock Out Condus</Label>
                      <Input
                        type="time"
                        value={drivingClockOut}
                        onChange={(e) => setDrivingClockOut(e.target.value)}
                        disabled={!applyToDriving}
                      />
                    </div>
                  </div>
                </div>

                {/* Passenger section */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">👤 Pasager</h4>
                    <Checkbox
                      id="apply-passenger"
                      checked={applyToPassenger}
                      onCheckedChange={(checked) => setApplyToPassenger(checked as boolean)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Clock In Pasager</Label>
                      <Input
                        type="time"
                        value={passengerClockIn}
                        onChange={(e) => setPassengerClockIn(e.target.value)}
                        disabled={!applyToPassenger}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Clock Out Pasager</Label>
                      <Input
                        type="time"
                        value={passengerClockOut}
                        onChange={(e) => setPassengerClockOut(e.target.value)}
                        disabled={!applyToPassenger}
                      />
                    </div>
                  </div>
                </div>

                {/* Equipment section */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">⚙️ Utilaj</h4>
                    <Checkbox
                      id="apply-equipment"
                      checked={applyToEquipment}
                      onCheckedChange={(checked) => setApplyToEquipment(checked as boolean)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Clock In Utilaj</Label>
                      <Input
                        type="time"
                        value={equipmentClockIn}
                        onChange={(e) => setEquipmentClockIn(e.target.value)}
                        disabled={!applyToEquipment}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Clock Out Utilaj</Label>
                      <Input
                        type="time"
                        value={equipmentClockOut}
                        onChange={(e) => setEquipmentClockOut(e.target.value)}
                        disabled={!applyToEquipment}
                      />
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <h4 className="font-semibold mb-2">Preview ({driverUpdates.length} pontaje):</h4>
                  <div className="space-y-1 text-sm">
                    {driverUpdates.map((update, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{update.userName}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(update.clockIn), 'HH:mm')} → {format(new Date(update.clockOut), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button
            onClick={handleSave}
            disabled={totalUpdates.length === 0 || bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending ? 'Se actualizează...' : `Salvează (${totalUpdates.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
