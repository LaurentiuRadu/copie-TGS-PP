import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Clock, Calendar, Split } from "lucide-react";

interface Segment {
  start: string;
  end: string;
  hours: number;
  type: string;
  dayOfWeek: string;
}

export const TimeSegmentDebugPanel = () => {
  const [clockInTime, setClockInTime] = useState("2025-10-03T14:45:57");
  const [clockOutTime, setClockOutTime] = useState("2025-10-04T08:00:00");
  const [shiftType, setShiftType] = useState<'normal' | 'condus' | 'pasager' | 'utilaj'>('normal');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const getNextCriticalTime = (currentTime: Date): Date => {
    const result = new Date(currentTime);
    const h = result.getHours();
    const m = result.getMinutes();
    const s = result.getSeconds();
    const totalSeconds = h * 3600 + m * 60 + s;

    // Before 06:00 → go to 06:00
    if (totalSeconds < 6 * 3600) {
      result.setHours(6, 0, 0, 0);
      return result;
    }
    
    // At 06:00:00 exactly → go to 06:01:00 (critical for Saturday/Sunday/Holiday transitions)
    if (totalSeconds === 6 * 3600) {
      result.setHours(6, 1, 0, 0);
      return result;
    }
    
    // Between 06:00:01 and 22:00 → go to 22:00
    if (totalSeconds < 22 * 3600) {
      result.setHours(22, 0, 0, 0);
      return result;
    }

    // >= 22:00 → next day 00:00
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const determineHoursType = (segmentStart: Date): string => {
    const dayOfWeek = segmentStart.getDay(); // 0=Duminică, 6=Sâmbătă
    const startHour = segmentStart.getHours();
    const startMinute = segmentStart.getMinutes();

    // SÂMBĂTĂ-DUMINICĂ (Sâmbătă 06:01 → Duminică 06:00)
    if (
      (dayOfWeek === 6 && (startHour > 6 || (startHour === 6 && startMinute >= 1))) || // Sâmbătă de la 06:01
      (dayOfWeek === 0 && (startHour < 6 || (startHour === 6 && startMinute === 0)))  // Duminică până la 06:00
    ) {
      return "hours_saturday";
    }
    
    // DUMINICĂ (Duminică 06:01 → 24:00)
    if (dayOfWeek === 0 && (startHour > 6 || (startHour === 6 && startMinute >= 1))) {
      return "hours_sunday";
    }
    
    // NOAPTE (22:00 → 06:00)
    if (startHour >= 22) {
      return "hours_night";
    }
    
    if (startHour < 6 || (startHour === 6 && startMinute === 0)) {
      return "hours_night";
    }
    
    // ORE NORMALE (06:01 → 21:59:59)
    return "hours_regular";
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
    return days[dayOfWeek];
  };

  const calculateSegments = () => {
    try {
      setIsCalculating(true);
      const start = new Date(clockInTime);
      const end = new Date(clockOutTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        toast.error("Date invalide! Verifică formatul (YYYY-MM-DDTHH:mm:ss)");
        return;
      }

      if (start >= end) {
        toast.error("Clock-in trebuie să fie înainte de clock-out!");
        return;
      }

      const calculatedSegments: Segment[] = [];

      // Verifică tipul de shift
      if (shiftType === 'condus' || shiftType === 'pasager' || shiftType === 'utilaj') {
        // Pentru shift-uri speciale: toată durata într-o singură categorie
        const hoursDecimal = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const roundedHours = Math.round(hoursDecimal * 100) / 100;
        
        const typeMap = {
          'condus': 'hours_driving',
          'pasager': 'hours_passenger',
          'utilaj': 'hours_equipment'
        };

        calculatedSegments.push({
          start: start.toISOString(),
          end: end.toISOString(),
          hours: roundedHours,
          type: typeMap[shiftType],
          dayOfWeek: getDayName(start.getDay()),
        });
      } else {
        // Pentru shift "normal": segmentare automată pe zi/noapte/weekend
        let currentTime = new Date(start);

        while (currentTime < end) {
          const nextCritical = getNextCriticalTime(currentTime);
          const segmentEnd = nextCritical > end ? end : nextCritical;

          const hoursDecimal = (segmentEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
          const roundedHours = Math.round(hoursDecimal * 100) / 100;

          if (roundedHours > 0) {
            const hoursType = determineHoursType(currentTime);
            const dayOfWeek = getDayName(currentTime.getDay());

            calculatedSegments.push({
              start: currentTime.toISOString(),
              end: segmentEnd.toISOString(),
              hours: roundedHours,
              type: hoursType,
              dayOfWeek,
            });
          }

          currentTime = segmentEnd;
        }
      }

      setSegments(calculatedSegments);
      toast.success(`Segmentat în ${calculatedSegments.length} intervale (Tip: ${shiftType})`);
    } catch (error) {
      console.error("Error calculating segments:", error);
      toast.error("Eroare la calcularea segmentelor");
    } finally {
      setIsCalculating(false);
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "hours_regular":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "hours_night":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
      case "hours_saturday":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
      case "hours_sunday":
        return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
      case "hours_holiday":
        return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
      case "hours_driving":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
      case "hours_passenger":
        return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20";
      case "hours_equipment":
        return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20";
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "hours_regular":
        return "Normal";
      case "hours_night":
        return "Noapte";
      case "hours_saturday":
        return "Sâmbătă";
      case "hours_sunday":
        return "Duminică";
      case "hours_holiday":
        return "Sărbătoare";
      case "hours_driving":
        return "Condus";
      case "hours_passenger":
        return "Pasager";
      case "hours_equipment":
        return "Utilaj";
      default:
        return type;
    }
  };

  const totalByType = segments.reduce((acc, seg) => {
    acc[seg.type] = (acc[seg.type] || 0) + seg.hours;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Split className="h-5 w-5" />
          <CardTitle>Debug: Segmentare Timp</CardTitle>
        </div>
        <CardDescription>
          Vizualizează cum se împart orele între categorii (Normal/Noapte/Sâmbătă/Duminică)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="clock-in" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Clock-in
            </Label>
            <Input
              id="clock-in"
              type="text"
              value={clockInTime}
              onChange={(e) => setClockInTime(e.target.value)}
              placeholder="2025-10-03T14:45:57"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clock-out" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Clock-out
            </Label>
            <Input
              id="clock-out"
              type="text"
              value={clockOutTime}
              onChange={(e) => setClockOutTime(e.target.value)}
              placeholder="2025-10-04T08:00:00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-type" className="flex items-center gap-2">
              <Split className="h-4 w-4" />
              Tip Shift
            </Label>
            <select
              id="shift-type"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as 'normal' | 'condus' | 'pasager' | 'utilaj')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="normal">Normal (segmentare automată)</option>
              <option value="condus">Condus</option>
              <option value="pasager">Pasager</option>
              <option value="utilaj">Utilaj</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {shiftType === 'normal' ? 'Segmentare zi/noapte/weekend' : 'Toată durata în categoria selectată'}
            </p>
          </div>
        </div>

        <Button onClick={calculateSegments} disabled={isCalculating} className="w-full">
          {isCalculating ? "Se calculează..." : "Calculează Segmente"}
        </Button>

        {/* Summary Section */}
        {segments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sumar Ore
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {Object.entries(totalByType).map(([type, hours]) => (
                  <div key={type} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <span className="text-sm font-medium">{getTypeLabel(type)}</span>
                    <Badge className={getTypeColor(type)}>
                      {hours.toFixed(2)}h
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">
                    {Object.values(totalByType).reduce((a, b) => a + b, 0).toFixed(2)}h
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Segments Detail */}
            <div className="space-y-3">
              <h3 className="font-semibold">Segmente Detaliate</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {segments.map((segment, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className={getTypeColor(segment.type)}>
                        {getTypeLabel(segment.type)}
                      </Badge>
                      <span className="text-sm font-mono font-semibold">
                        {segment.hours.toFixed(2)}h
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{segment.dayOfWeek}</span>
                      </div>
                      <div className="font-mono text-xs">
                        <div>Start: {new Date(segment.start).toLocaleString("ro-RO")}</div>
                        <div>End: {new Date(segment.end).toLocaleString("ro-RO")}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
