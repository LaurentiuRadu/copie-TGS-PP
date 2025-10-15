import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parse, isValid } from "date-fns";

interface EditingCell {
  rowId: string;
  field: "clockIn" | "clockOut";
}

export function useInlineTimeEdit() {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [tempValue, setTempValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTimeMutation = useMutation({
    mutationFn: async ({
      entryId,
      field,
      newTime,
      originalEntry,
    }: {
      entryId: string;
      field: "clockIn" | "clockOut";
      newTime: string;
      originalEntry: any;
    }) => {
      // Parse the time (HH:mm format)
      const [hours, minutes] = newTime.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        throw new Error("Format oră invalid. Folosește HH:mm");
      }

      // Get the original date
      const originalDate = new Date(
        field === "clockIn" ? originalEntry.clock_in_time : originalEntry.clock_out_time || originalEntry.clock_in_time
      );

      // Create new date with updated time
      const newDate = new Date(originalDate);
      newDate.setHours(hours, minutes, 0, 0);

      // Validate the new time
      if (field === "clockOut" && originalEntry.clock_in_time) {
        const clockInDate = new Date(originalEntry.clock_in_time);
        if (newDate <= clockInDate) {
          throw new Error("Clock-out trebuie să fie după clock-in");
        }

        const durationHours = (newDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
        if (durationHours > 24) {
          throw new Error("Durată maximă: 24 ore");
        }
        if (durationHours < 0.17) {
          throw new Error("Durată minimă: 10 minute");
        }
      }

      // Fetch current entry to check if already has originals
      const { data: currentEntry } = await supabase
        .from("time_entries")
        .select("original_clock_in_time, original_clock_out_time, clock_in_time, clock_out_time")
        .eq("id", entryId)
        .single();

      const updateData: any = {
        [field === "clockIn" ? "clock_in_time" : "clock_out_time"]: newDate.toISOString(),
        was_edited_by_admin: true,
        needs_reprocessing: true,
      };

      // Set originals only if not already set
      if (currentEntry) {
        if (field === "clockIn" && !currentEntry.original_clock_in_time) {
          updateData.original_clock_in_time = currentEntry.clock_in_time;
        }
        if (field === "clockOut" && !currentEntry.original_clock_out_time) {
          updateData.original_clock_out_time = currentEntry.clock_out_time;
        }
      }

      const { error: updateError } = await supabase
        .from("time_entries")
        .update(updateData)
        .eq("id", entryId);

      if (updateError) throw updateError;

      // Trigger recalculation
      const { error: funcError } = await supabase.functions.invoke("calculate-time-segments", {
        body: {
          time_entry_id: entryId,
          user_id: originalEntry.user_id,
          clock_in_time: field === "clockIn" ? newDate.toISOString() : originalEntry.clock_in_time,
          clock_out_time: field === "clockOut" ? newDate.toISOString() : originalEntry.clock_out_time,
        },
      });

      if (funcError) {
        console.warn("[Inline Edit] Recalculation warning:", funcError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["daily-timesheets"] });
      toast({
        title: "✅ Ora actualizată",
        description: "Modificarea a fost salvată cu succes",
      });
      setEditingCell(null);
      setTempValue("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Eroare",
        description: error.message,
      });
    },
  });

  const startEdit = (rowId: string, field: "clockIn" | "clockOut", currentValue: string) => {
    setEditingCell({ rowId, field });
    setTempValue(currentValue);
  };

  const handleInputChange = (value: string) => {
    setTempValue(value);
  };

  const handleSave = (rowId: string, field: "clockIn" | "clockOut", originalEntry: any) => {
    if (!tempValue || tempValue === formatTime(field === "clockIn" ? originalEntry.clock_in_time : originalEntry.clock_out_time)) {
      setEditingCell(null);
      setTempValue("");
      return;
    }

    updateTimeMutation.mutate({
      entryId: rowId,
      field,
      newTime: tempValue,
      originalEntry,
    });
  };

  const handleCancel = () => {
    setEditingCell(null);
    setTempValue("");
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    return format(new Date(dateStr), "HH:mm");
  };

  return {
    editingCell,
    tempValue,
    startEdit,
    handleInputChange,
    handleSave,
    handleCancel,
    isSaving: updateTimeMutation.isPending,
  };
}
