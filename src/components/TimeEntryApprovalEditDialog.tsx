import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface TimeEntryApprovalEditDialogProps {
  entry: {
    id: string;
    user_id: string;
    clock_in_time: string;
    clock_out_time: string;
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
    format(new Date(entry.clock_out_time), "yyyy-MM-dd'T'HH:mm")
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validateDuration = () => {
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

      // Prepare update data
      const updateData: any = {
        clock_in_time: new Date(clockIn).toISOString(),
        clock_out_time: new Date(clockOut).toISOString(),
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approval_notes: adminNotes || null,
        needs_reprocessing: false,
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

      // Trigger recalculation
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      
      toast({
        title: "✅ Pontaj corectat și aprobat",
        description: "Modificările au fost salvate și pontajul a fost aprobat automat.",
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
    updateAndApprove.mutate();
  };

  const calculateDuration = () => {
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
            disabled={updateAndApprove.isPending || !!validateDuration()}
          >
            {updateAndApprove.isPending ? "Salvez..." : "Salvează și Aprobă"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
