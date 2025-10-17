import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { cn, normalizeTimeInput } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TimeEntryCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUEST_TYPES = [
  { value: "forgot_clock_in", label: "Am uitat să mă pontez la intrare" },
  { value: "forgot_clock_out", label: "Am uitat să mă pontez la ieșire" },
  { value: "wrong_time", label: "Am pontat la ora greșită" },
  { value: "wrong_shift_type", label: "Am selectat tipul de tură greșit" },
  { value: "duplicate_entry", label: "Am un pontaj duplicat/eronat" },
  { value: "other", label: "Altă problemă" },
];

const SHIFT_TYPES = [
  { value: "Normal", label: "Normal" },
  { value: "Condus", label: "Condus" },
  { value: "Pasager", label: "Pasager" },
  { value: "Utilaj", label: "Utilaj" },
];

export function TimeEntryCorrectionDialog({ open, onOpenChange }: TimeEntryCorrectionDialogProps) {
  const queryClient = useQueryClient();
  const [requestType, setRequestType] = useState<string>("");
  const [workDate, setWorkDate] = useState<Date>();
  const [description, setDescription] = useState("");
  const [proposedClockIn, setProposedClockIn] = useState("");
  const [proposedClockOut, setProposedClockOut] = useState("");
  const [proposedShiftType, setProposedShiftType] = useState("");

  const createRequestMutation = useMutation({
    mutationFn: async (data: {
      request_type: string;
      work_date: string;
      description: string;
      proposed_clock_in?: string;
      proposed_clock_out?: string;
      proposed_shift_type?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const insertData: any = {
        user_id: userData.user.id,
        request_type: data.request_type,
        work_date: data.work_date,
        description: data.description,
      };

      if (data.proposed_clock_in) insertData.proposed_clock_in = data.proposed_clock_in;
      if (data.proposed_clock_out) insertData.proposed_clock_out = data.proposed_clock_out;
      if (data.proposed_shift_type) insertData.proposed_shift_type = data.proposed_shift_type;

      const { error } = await supabase.from("time_entry_correction_requests").insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cererea ta a fost trimisă cu succes!");
      queryClient.invalidateQueries({ queryKey: ["correctionRequests"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Eroare la trimiterea cererii");
    },
  });

  const resetForm = () => {
    setRequestType("");
    setWorkDate(undefined);
    setDescription("");
    setProposedClockIn("");
    setProposedClockOut("");
    setProposedShiftType("");
  };

  const handleSubmit = () => {
    if (!requestType || !workDate || description.length < 10) {
      toast.error("Te rog completează toate câmpurile obligatorii");
      return;
    }

    const data: any = {
      request_type: requestType,
      work_date: format(workDate, "yyyy-MM-dd"),
      description,
    };

    if (proposedClockIn) {
      data.proposed_clock_in = `${format(workDate, "yyyy-MM-dd")}T${proposedClockIn}:00+03:00`;
    }
    if (proposedClockOut) {
      data.proposed_clock_out = `${format(workDate, "yyyy-MM-dd")}T${proposedClockOut}:00+03:00`;
    }
    if (proposedShiftType) {
      data.proposed_shift_type = proposedShiftType;
    }

    createRequestMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raportează Problemă Pontaj</DialogTitle>
          <DialogDescription>
            Completează formularul pentru a solicita corecția unui pontaj
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tip Problemă */}
          <div className="space-y-2">
            <Label>Tip Problemă *</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează tipul problemei" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data Pontajului *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !workDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {workDate ? format(workDate, "PPP", { locale: ro }) : "Selectează data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={workDate}
                  onSelect={setWorkDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Explicație */}
          <div className="space-y-2">
            <Label>Explicație * (minim 10 caractere)</Label>
            <Textarea
              placeholder="Descrie problema în detaliu..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/10 caractere minime
            </p>
          </div>

          {/* Propunere Ora Intrare (Opțional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Propunere Oră Intrare (opțional)
            </Label>
            <Input
              type="time"
              value={proposedClockIn}
              onChange={(e) => setProposedClockIn(e.target.value)}
              onBlur={(e) => {
                const normalized = normalizeTimeInput(e.target.value);
                setProposedClockIn(normalized);
              }}
            />
          </div>

          {/* Propunere Ora Ieșire (Opțional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Propunere Oră Ieșire (opțional)
            </Label>
            <Input
              type="time"
              value={proposedClockOut}
              onChange={(e) => setProposedClockOut(e.target.value)}
              onBlur={(e) => {
                const normalized = normalizeTimeInput(e.target.value);
                setProposedClockOut(normalized);
              }}
            />
          </div>

          {/* Propunere Tip Tură (Opțional) */}
          <div className="space-y-2">
            <Label>Propunere Tip Tură (opțional)</Label>
            <Select value={proposedShiftType} onValueChange={setProposedShiftType}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează tipul de tură" />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createRequestMutation.isPending}
          >
            {createRequestMutation.isPending ? "Se trimite..." : "Trimite Cererea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
