import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatRomania } from '@/lib/timezone';
import { Loader2 } from 'lucide-react';

interface SegmentTimeEditDialogProps {
  entry: any;
  segment: {
    id: string;
    start_time: string;
    end_time: string;
    hours_decimal: number;
    segment_type: string;
  };
  workDate: string;
  teamId: string;
  vehicle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  segment_id: string;
  current_start: string;
  current_end: string;
}

export const SegmentTimeEditDialog = ({
  entry,
  segment,
  workDate,
  teamId,
  vehicle,
  open,
  onOpenChange,
}: SegmentTimeEditDialogProps) => {
  const queryClient = useQueryClient();
  const [newStartTime, setNewStartTime] = useState(
    formatRomania(segment.start_time, 'HH:mm')
  );
  const [newEndTime, setNewEndTime] = useState(
    formatRomania(segment.end_time, 'HH:mm')
  );
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

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

  const calculateHours = (start: string, end: string): number => {
    const startDate = new Date(`2000-01-01T${start}:00`);
    const endDate = new Date(`2000-01-01T${end}:00`);
    const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return Math.max(0, diff);
  };

  // Find team members with same segment type in same temporal window
  const findTeamMembers = async (): Promise<TeamMember[]> => {
    const TOLERANCE_MINUTES = 15;
    const segmentStart = new Date(segment.start_time);
    const weekStart = new Date(workDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const dayOfWeek = new Date(workDate).getDay();

    // 1. Get team members from weekly_schedules
    const { data: schedules, error: schedError } = await supabase
      .from('weekly_schedules')
      .select('user_id, profiles!inner(full_name)')
      .eq('team_id', teamId)
      .eq('week_start_date', weekStart.toISOString().split('T')[0])
      .eq('day_of_week', dayOfWeek)
      .neq('user_id', entry.user_id);

    if (schedError || !schedules) {
      console.error('[SegmentEdit] Error fetching team:', schedError);
      return [];
    }

    // 2. Get time entries for these members on this date
    const userIds = schedules.map(s => s.user_id);
    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select('id, user_id')
      .in('user_id', userIds)
      .gte('clock_in_time', `${workDate}T00:00:00Z`)
      .lt('clock_in_time', `${workDate}T23:59:59Z`);

    if (entriesError || !entries) {
      console.error('[SegmentEdit] Error fetching entries:', entriesError);
      return [];
    }

    // 3. Get matching segments (same type, within ±15 min window)
    const clockInStart = new Date(segmentStart.getTime() - TOLERANCE_MINUTES * 60 * 1000);
    const clockInEnd = new Date(segmentStart.getTime() + TOLERANCE_MINUTES * 60 * 1000);

    const { data: segments, error: segError } = await supabase
      .from('time_entry_segments')
      .select('id, time_entry_id, start_time, end_time')
      .eq('segment_type', segment.segment_type)
      .in('time_entry_id', entries.map(e => e.id))
      .gte('start_time', clockInStart.toISOString())
      .lte('start_time', clockInEnd.toISOString());

    if (segError || !segments) {
      console.error('[SegmentEdit] Error fetching segments:', segError);
      return [];
    }

    // 4. Map to team members with segment info
    return segments
      .map(seg => {
        const timeEntry = entries.find(e => e.id === seg.time_entry_id);
        const schedule = schedules.find(s => s.user_id === timeEntry?.user_id);
        if (!schedule || !timeEntry) return null;

        return {
          user_id: timeEntry.user_id,
          full_name: (schedule.profiles as any)?.full_name || 'Necunoscut',
          segment_id: seg.id,
          current_start: seg.start_time,
          current_end: seg.end_time,
        };
      })
      .filter(Boolean) as TeamMember[];
  };

  // Update mutation for single user
  const updateMutation = useMutation({
    mutationFn: async (applyToTeam: boolean) => {
      const hours = calculateHours(newStartTime, newEndTime);
      
      if (hours <= 0) {
        throw new Error('Intervalul orar nu este valid');
      }

      // Validate within main time_entry bounds
      const entryStart = new Date(entry.clock_in_time);
      const entryEnd = entry.clock_out_time ? new Date(entry.clock_out_time) : new Date();
      const newStart = new Date(`${workDate}T${newStartTime}:00Z`);
      const newEnd = new Date(`${workDate}T${newEndTime}:00Z`);

      if (newStart < entryStart || newEnd > entryEnd) {
        throw new Error('Segmentul trebuie să fie în interiorul pontajului principal');
      }

      const segmentsToUpdate = applyToTeam 
        ? [segment.id, ...teamMembers.map(m => m.segment_id)]
        : [segment.id];

      // Update all segments
      for (const segId of segmentsToUpdate) {
        const { error: updateError } = await supabase
          .from('time_entry_segments')
          .update({
            start_time: `${workDate}T${newStartTime}:00Z`,
            end_time: `${workDate}T${newEndTime}:00Z`,
            hours_decimal: hours,
          })
          .eq('id', segId);

        if (updateError) throw updateError;

        // Get time_entry_id for recalculation
        const { data: segData } = await supabase
          .from('time_entry_segments')
          .select('time_entry_id')
          .eq('id', segId)
          .single();

        if (segData) {
          // Trigger recalculation
          await supabase.functions.invoke('calculate-time-segments', {
            body: {
              time_entry_id: segData.time_entry_id,
              user_id: entry.user_id,
              clock_in_time: entry.clock_in_time,
              clock_out_time: entry.clock_out_time,
            },
          });
        }
      }
    },
    onSuccess: (_, applyToTeam) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      
      const count = applyToTeam ? teamMembers.length + 1 : 1;
      toast.success(`✅ Segment actualizat pentru ${count} ${count === 1 ? 'angajat' : 'angajați'}`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`❌ Eroare: ${error.message}`);
    },
  });

  const handleSubmit = async () => {
    // Check if there are team members to sync
    const members = await findTeamMembers();
    setTeamMembers(members);

    if (members.length > 0) {
      setShowTeamDialog(true);
    } else {
      updateMutation.mutate(false);
    }
  };

  const handleTeamApply = (applyToTeam: boolean) => {
    setShowTeamDialog(false);
    updateMutation.mutate(applyToTeam);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ✏️ Editare Segment: {getSegmentLabel(segment.segment_type)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info context */}
            <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Angajat:</span>
                <span className="font-medium">{entry.profiles?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Echipă:</span>
                <Badge variant="outline">{teamId}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mașină:</span>
                <Badge variant="outline">{vehicle}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pontaj principal:</span>
                <span className="font-mono text-xs">
                  {formatRomania(entry.clock_in_time, 'HH:mm')} - {entry.clock_out_time ? formatRomania(entry.clock_out_time, 'HH:mm') : '—'}
                </span>
              </div>
            </div>

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Ora Intrare</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">Ora Ieșire</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Calculated hours */}
            <div className="bg-primary/5 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ore calculate:</span>
                <span className="font-bold text-lg">
                  {calculateHours(newStartTime, newEndTime).toFixed(2)}h
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Anulează
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team sync confirmation dialog */}
      <AlertDialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              🚗 Normalizare ore {getSegmentLabel(segment.segment_type).toLowerCase()}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Am detectat <strong>{teamMembers.length}</strong> {teamMembers.length === 1 ? 'coleg' : 'colegi'} din echipa <strong>{teamId}</strong> ({vehicle}) cu segmente de tip "{getSegmentLabel(segment.segment_type)}" în aceeași cursă:
                </p>
                
                <ul className="space-y-1 pl-4">
                  {teamMembers.map(member => (
                    <li key={member.user_id} className="text-sm">
                      • <strong>{member.full_name}</strong>
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        ({formatRomania(member.current_start, 'HH:mm')} - {formatRomania(member.current_end, 'HH:mm')})
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Modificare:</span>
                    <span className="font-mono">
                      {formatRomania(segment.start_time, 'HH:mm')} - {formatRomania(segment.end_time, 'HH:mm')}
                      <span className="mx-2">→</span>
                      {newStartTime} - {newEndTime}
                    </span>
                  </div>
                </div>

                <p className="font-medium">
                  Aplici modificarea pentru:
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleTeamApply(false)}>
              Doar {entry.profiles?.full_name}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleTeamApply(true)}>
              Toată echipa ({teamMembers.length + 1})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
