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
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { QUERY_KEYS } from '@/lib/queryKeys';

interface TimeEntryManualCorrectionDialogProps {
  entry: {
    id: string;
    user_id: string;
    clock_in_time: string;
    clock_out_time: string;
    profiles: {
      id: string;
      full_name: string;
      username: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimeEntryManualCorrectionDialog({
  entry,
  open,
  onOpenChange,
}: TimeEntryManualCorrectionDialogProps) {
  const [clockIn, setClockIn] = useState(
    format(new Date(entry.clock_in_time), "yyyy-MM-dd'T'HH:mm")
  );
  const [clockOut, setClockOut] = useState(
    entry.clock_out_time 
      ? format(new Date(entry.clock_out_time), "yyyy-MM-dd'T'HH:mm")
      : '' // ✅ FIX: Dacă NULL, setează string gol pentru input manual
  );
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validateDuration = () => {
    if (!clockOut) {
      return 'Clock-out este obligatoriu';
    }
    
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    
    // ✅ Validare Date invalid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Format date invalid';
    }

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (durationHours <= 0) {
      return "Clock-out trebuie să fie după clock-in";
    }
    if (durationHours > 24) {
      return "Durată maximă: 24 ore (folosește cereri de corecție pentru ture multiple)";
    }
    return null;
  };

  const updateEntry = useMutation({
    mutationFn: async () => {
      const validationError = validateDuration();
      if (validationError) {
        throw new Error(validationError);
      }

      // Update time entry
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_in_time: new Date(clockIn).toISOString(),
          clock_out_time: new Date(clockOut).toISOString(),
          needs_reprocessing: false, // ✅ Clear after correction
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (updateError) throw updateError;

      // Trigger recalculation
      const { error: functionError } = await supabase.functions.invoke('calculate-time-segments', {
        body: {
          user_id: entry.user_id,  // ✅ FIX: user_id corect (nu entry.id)
          time_entry_id: entry.id,
          clock_in_time: new Date(clockIn).toISOString(),
          clock_out_time: new Date(clockOut).toISOString(),
        },
      });

      if (functionError) {
        console.warn('[Manual Correction] Recalculation warning:', functionError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspicious-entries'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timeEntries() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      
      toast({
        title: "✅ Pontaj corectat",
        description: "Modificările au fost salvate și pontajul va fi reprocesar.",
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
    updateEntry.mutate();
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
          <DialogTitle>Corectare Manuală Pontaj</DialogTitle>
          <DialogDescription>
            {entry.profiles.full_name || entry.profiles.username}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateEntry.isPending || !!validateDuration()}
          >
            {updateEntry.isPending ? "Salvez..." : "Salvează și Reprocesează"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}