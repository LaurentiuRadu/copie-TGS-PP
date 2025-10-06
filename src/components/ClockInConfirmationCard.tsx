import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, MapPin, Timer } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface ClockInConfirmationCardProps {
  type: "clock-in" | "clock-out";
  timestamp: string;
  locationName: string;
  locationDistance: number;
  latitude: number;
  longitude: number;
  shiftType?: string;
  onClose: () => void;
}

export function ClockInConfirmationCard({
  type,
  timestamp,
  locationName,
  locationDistance,
  latitude,
  longitude,
  shiftType,
  onClose,
}: ClockInConfirmationCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-x-4 top-24 z-50 transition-all duration-300 transform ${
        isVisible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95"
      }`}
      onClick={() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }}
    >
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/30 shadow-elegant">
        <CardContent className="p-6 space-y-4">
          {/* Success Icon */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative bg-primary/10 p-3 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-primary animate-scale-in" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold text-foreground">
              {type === "clock-in" ? "Pontaj Început!" : "Pontaj Terminat!"}
            </h3>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              {type === "clock-in" ? "Intrare" : "Ieșire"}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-3 pt-2">
            {/* Time */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Ora</p>
                <p className="font-semibold text-foreground">
                  {format(new Date(timestamp), "HH:mm:ss", { locale: ro })}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Locație</p>
                <p className="font-semibold text-foreground">
                  {locationName}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({Math.round(locationDistance)}m)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  GPS: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Shift Type (only for clock-in) */}
            {type === "clock-in" && shiftType && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Timer className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Tip Tură</p>
                  <p className="font-semibold text-foreground">{shiftType}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tap to dismiss hint */}
          <p className="text-xs text-center text-muted-foreground pt-2">
            Apasă pentru a închide
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
