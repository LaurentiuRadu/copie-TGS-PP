import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Camera, AlertCircle, Timer } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface ClockConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  type: "clock-in" | "clock-out";
  shiftType?: string;
  location?: { name: string; address?: string } | null;
  photoUrl?: string | null;
  loading?: boolean;
}

export function ClockConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  type,
  shiftType = "Normal",
  location,
  photoUrl,
  loading = false,
}: ClockConfirmationDialogProps) {
  const { triggerHaptic } = useHapticFeedback();

  const isClockIn = type === "clock-in";
  const currentTime = new Date();

  const handleConfirm = () => {
    triggerHaptic("medium");
    onConfirm();
  };

  const handleCancel = () => {
    triggerHaptic("light");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div
              className={`h-3 w-3 rounded-full animate-pulse ${
                isClockIn ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {isClockIn ? "📍 Confirmă Pontaj Intrare" : "🏁 Confirmă Pontaj Ieșire"}
          </DialogTitle>
          <DialogDescription className="text-base">
            Verifică informațiile înainte de a confirma pontajul
          </DialogDescription>
        </DialogHeader>

        <Card className={`border-2 ${isClockIn ? "border-green-500/30 bg-green-50 dark:bg-green-950/10" : "border-red-500/30 bg-red-50 dark:bg-red-950/10"}`}>
          <CardContent className="pt-6 space-y-4">
            {/* Ora Curentă - Mare și vizibilă */}
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border-2 border-primary/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <span className="font-semibold text-lg">Oră Pontaj</span>
              </div>
              <span className="text-3xl font-bold tabular-nums text-primary">
                {format(currentTime, "HH:mm:ss")}
              </span>
            </div>

            {/* Data */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
              <span className="text-muted-foreground font-medium">Data</span>
              <span className="font-semibold">
                {format(currentTime, "EEEE, dd MMMM yyyy", { locale: ro })}
              </span>
            </div>

            {/* Tip Tură - Doar la Clock-In */}
            {isClockIn && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="font-medium">Tip Tură</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-base px-3 py-1 ${
                    shiftType === "Condus" ? "border-blue-500 text-blue-700 dark:text-blue-300" :
                    shiftType === "Pasager" ? "border-purple-500 text-purple-700 dark:text-purple-300" :
                    shiftType === "Utilaj" ? "border-orange-500 text-orange-700 dark:text-orange-300" :
                    "border-green-500 text-green-700 dark:text-green-300"
                  }`}
                >
                  {shiftType}
                </Badge>
              </div>
            )}

            {/* Locație */}
            {location && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 dark:text-blue-100 text-base">
                    {location.name}
                  </p>
                  {location.address && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 break-words">
                      📍 {location.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Preview Fotografie */}
            {photoUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Camera className="h-5 w-5 text-primary" />
                  <span>Fotografie Verificare Facială</span>
                </div>
                <div className="relative rounded-lg overflow-hidden border-2 border-muted">
                  <img
                    src={photoUrl}
                    alt="Preview pontaj"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    ✓ Verificat
                  </div>
                </div>
              </div>
            )}

            {/* Warning Important */}
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium mb-1">
                  ⚠️ Confirmă că toate datele sunt corecte
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  După confirmare, pontajul va fi înregistrat permanent în sistem și va conta pentru foaia ta de pontaj.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter className="flex gap-2 sm:gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 h-12 text-base"
          >
            ✕ Anulează
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 h-12 text-base gap-2 font-semibold ${
              isClockIn
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {loading ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Se procesează...
              </>
            ) : (
              <>
                <Clock className="h-5 w-5" />
                ✓ Confirmă Pontajul
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
