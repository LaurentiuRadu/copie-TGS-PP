import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { formatRomania } from "@/lib/timezone";

interface DeleteTimeEntryDialogProps {
  entry: {
    id: string;
    user_id: string;
    clock_in_time: string;
    clock_out_time: string | null;
    profiles: {
      full_name: string;
      username: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTimeEntryDialog({
  entry,
  open,
  onOpenChange,
}: DeleteTimeEntryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      // Delete time entry segments first (cascade might not be enabled)
      const { error: segmentsError } = await supabase
        .from('time_entry_segments')
        .delete()
        .eq('time_entry_id', entryId);

      if (segmentsError) {
        console.warn('[Delete] Failed to delete segments:', segmentsError);
      }

      // Delete the time entry
      const { error: entryError } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (entryError) throw entryError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      
      toast({
        title: "✅ Pontaj șters",
        description: "Pontajul a fost șters permanent din sistem.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Eroare",
        description: `Nu s-a putut șterge pontajul: ${error.message}`,
      });
    },
  });

  const handleDelete = () => {
    if (!entry) return;
    deleteMutation.mutate(entry.id);
  };

  if (!entry) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Sigur vrei să ștergi acest pontaj?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium text-foreground mb-2">
                {entry.profiles.full_name} ({entry.profiles.username})
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Intrare:</p>
                  <p className="font-mono text-foreground">
                    {formatRomania(entry.clock_in_time, 'HH:mm')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ieșire:</p>
                  <p className="font-mono text-foreground">
                    {entry.clock_out_time
                      ? formatRomania(entry.clock_out_time, 'HH:mm')
                      : '(lipsă)'}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-red-600 font-medium">
              ⚠️ Această acțiune este PERMANENTĂ și nu poate fi anulată.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anulează</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMutation.isPending ? "Șterg..." : "Da, șterge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
