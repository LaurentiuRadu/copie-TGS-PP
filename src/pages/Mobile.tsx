import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Menu, Clock, LogOut, Car, Users, Briefcase, CheckCircle2, FolderOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ro } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ShiftType = "condus" | "pasager" | "normal" | null;

interface DayData {
  date: Date;
  normalHours: number;
  condusHours: number;
  pasagerHours: number;
}

// Mock data pentru calendar - în realitate va veni din baza de date
const mockMonthData: DayData[] = [
  { date: new Date(2025, 0, 2), normalHours: 8, condusHours: 0, pasagerHours: 0 },
  { date: new Date(2025, 0, 3), normalHours: 0, condusHours: 7, pasagerHours: 0 },
  { date: new Date(2025, 0, 6), normalHours: 0, condusHours: 0, pasagerHours: 8 },
  { date: new Date(2025, 0, 7), normalHours: 8, condusHours: 0, pasagerHours: 0 },
  { date: new Date(2025, 0, 8), normalHours: 0, condusHours: 6, pasagerHours: 0 },
];

const Mobile = () => {
  const { user, signOut } = useAuth();
  const [activeShift, setActiveShift] = useState<ShiftType>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  useEffect(() => {
    // Check location permission on mount
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationEnabled(true);
          setLocationError(null);
        },
        (error) => {
          setLocationEnabled(false);
          setLocationError("Locația trebuie activată pentru a folosi aplicația");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      // Watch location changes
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocationEnabled(true);
          setLocationError(null);
        },
        (error) => {
          setLocationEnabled(false);
          setLocationError("Locația trebuie activată pentru a folosi aplicația");
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationEnabled(false);
      setLocationError("Dispozitivul nu suportă locația");
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeShift) {
      interval = setInterval(() => {
        setShiftSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeShift]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleShiftStart = (type: ShiftType) => {
    if (!locationEnabled) {
      return;
    }
    setActiveShift(type);
    setShiftSeconds(0);
  };

  const handleShiftEnd = () => {
    // Aici se va salva în baza de date
    setActiveShift(null);
    setShiftSeconds(0);
  };

  const getShiftTypeLabel = (type: ShiftType) => {
    switch (type) {
      case "condus":
        return "Condus";
      case "pasager":
        return "Pasager";
      case "normal":
        return "Normal";
      default:
        return "";
    }
  };

  const getDayColor = (date: Date) => {
    const dayData = mockMonthData.find(
      (d) => format(d.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
    
    if (!dayData) return "";
    
    if (dayData.condusHours > 0) return "bg-blue-500/20 hover:bg-blue-500/30";
    if (dayData.pasagerHours > 0) return "bg-green-500/20 hover:bg-green-500/30";
    if (dayData.normalHours > 0) return "bg-purple-500/20 hover:bg-purple-500/30";
    
    return "";
  };

  const BREAK_MINUTES = 30;
  const todayTotalMinutes = 392; // Example: 6h 32m = 392 minutes
  const todayWorkedMinutes = Math.max(0, todayTotalMinutes - BREAK_MINUTES);
  const todayHours = `${Math.floor(todayWorkedMinutes / 60)}h ${todayWorkedMinutes % 60}m`;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">TimeTrack</h1>
              <p className="text-xs text-muted-foreground">{user?.user_metadata?.full_name || user?.email}</p>
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Meniu</SheetTitle>
                <SheetDescription>Opțiuni disponibile</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Clock className="h-4 w-4" />
                  Istoric Timp
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Task-uri
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Proiecte
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                  Deconectare
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Location Warning */}
        {!locationEnabled && locationError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{locationError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Shift Card */}
        <Card className={`shadow-lg ${activeShift ? "bg-gradient-primary" : "bg-card"}`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-lg ${activeShift ? "text-white" : "text-foreground"}`}>
              {activeShift ? "Tură Activă" : "Nicio tură activă"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-5xl font-bold tracking-wider ${activeShift ? "text-white" : "text-muted-foreground"}`}>
              {formatTime(shiftSeconds)}
            </div>
            {activeShift && (
              <div className={`flex items-center gap-2 text-sm ${activeShift ? "text-white/90" : "text-muted-foreground"}`}>
                {activeShift === "condus" && <Car className="h-4 w-4" />}
                {activeShift === "pasager" && <Users className="h-4 w-4" />}
                {activeShift === "normal" && <Briefcase className="h-4 w-4" />}
                <span>Tip: {getShiftTypeLabel(activeShift)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shift Controls */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-3">
              <Button
                size="lg"
                onClick={() => handleShiftStart("condus")}
                disabled={!locationEnabled || activeShift !== null}
                className="h-16 text-base bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Car className="h-6 w-6" />
                INTRARE CONDUS
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("pasager")}
                disabled={!locationEnabled || activeShift !== null}
                className="h-16 text-base bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Users className="h-6 w-6" />
                INTRARE PASAGER
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("normal")}
                disabled={!locationEnabled || activeShift !== null}
                className="h-16 text-base bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Briefcase className="h-6 w-6" />
                INTRARE
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleShiftEnd}
                disabled={!activeShift}
                className="h-16 text-base font-semibold"
              >
                IEȘIRE
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Calendar */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Calendar Lunar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedMonth}
              onSelect={(date) => date && setSelectedMonth(date)}
              locale={ro}
              className="rounded-md border w-full"
              modifiers={{
                condus: mockMonthData.filter(d => d.condusHours > 0).map(d => d.date),
                pasager: mockMonthData.filter(d => d.pasagerHours > 0).map(d => d.date),
                normal: mockMonthData.filter(d => d.normalHours > 0).map(d => d.date),
              }}
              modifiersClassNames={{
                condus: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-900 dark:text-blue-100",
                pasager: "bg-green-500/20 hover:bg-green-500/30 text-green-900 dark:text-green-100",
                normal: "bg-purple-500/20 hover:bg-purple-500/30 text-purple-900 dark:text-purple-100",
              }}
            />
            
            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500/30"></div>
                <span className="text-muted-foreground">Ore Normale</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500/30"></div>
                <span className="text-muted-foreground">Ore Condus</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/30"></div>
                <span className="text-muted-foreground">Ore Pasager</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Mobile;
