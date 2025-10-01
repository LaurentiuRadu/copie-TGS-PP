import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Menu, Clock, LogOut, Car, Users, Briefcase, CheckCircle2, FolderOpen, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCurrentPosition, findNearestLocation } from "@/lib/geolocation";
import { SelfieCapture } from "@/components/SelfieCapture";
import { PhotoEnrollment } from "@/components/PhotoEnrollment";
import { generateDeviceFingerprint, getDeviceInfo, getClientIP } from "@/lib/deviceFingerprint";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [activeTimeEntry, setActiveTimeEntry] = useState<any>(null);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [pendingSelfieAction, setPendingSelfieAction] = useState<'clock-in' | 'clock-out' | null>(null);
  const [pendingShiftType, setPendingShiftType] = useState<ShiftType>(null);
  const [clockInPhoto, setClockInPhoto] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [verifyingFace, setVerifyingFace] = useState(false);

  const requestLocationAccess = async () => {
    try {
      setLocationError(null);
      await getCurrentPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
      setLocationEnabled(true);
    } catch (e) {
      setLocationEnabled(false);
      setLocationError("Permisiunea pentru locație a fost refuzată sau indisponibilă");
    }
  };

  useEffect(() => {
    requestLocationAccess();
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    setUserProfile(data);

    // Check if user needs to enroll reference photo
    if (!data.reference_photo_url) {
      toast.error("Trebuie să înregistrezi o poză de referință înainte de a pontare");
      setShowEnrollment(true);
    }
  };

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

  const handleSelfieCapture = async (photoDataUrl: string) => {
    if (!userProfile?.reference_photo_url && pendingSelfieAction !== 'clock-in') {
      toast.error("Nu ai poză de referință înrolată");
      return;
    }

    if (pendingSelfieAction === 'clock-in') {
      // Verify face before clock-in
      setVerifyingFace(true);
      try {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-face', {
          body: { 
            referenceImage: userProfile.reference_photo_url,
            currentImage: photoDataUrl,
            action: 'verify'
          }
        });

        if (verifyError) throw verifyError;

        console.log('Face verification result:', verifyData);

        if (!verifyData.isValid) {
          toast.error(verifyData.reason || "Verificarea facială a eșuat. Încearcă din nou cu o poză mai clară.");
          setVerifyingFace(false);
          return;
        }

        toast.success(`Verificare reușită (${verifyData.confidence}% încredere)`);
        setClockInPhoto(photoDataUrl);
        performClockIn(photoDataUrl);
      } catch (error) {
        console.error('Face verification error:', error);
        toast.error("Eroare la verificarea facială. Încearcă din nou.");
      } finally {
        setVerifyingFace(false);
      }
    } else if (pendingSelfieAction === 'clock-out') {
      // Verify face before clock-out
      setVerifyingFace(true);
      try {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-face', {
          body: { 
            referenceImage: userProfile.reference_photo_url,
            currentImage: photoDataUrl,
            action: 'verify'
          }
        });

        if (verifyError) throw verifyError;

        console.log('Face verification result:', verifyData);

        if (!verifyData.isValid) {
          toast.error(verifyData.reason || "Verificarea facială a eșuat. Încearcă din nou cu o poză mai clară.");
          setVerifyingFace(false);
          return;
        }

        toast.success(`Verificare reușită (${verifyData.confidence}% încredere)`);
        performClockOut(photoDataUrl);
      } catch (error) {
        console.error('Face verification error:', error);
        toast.error("Eroare la verificarea facială. Încearcă din nou.");
      } finally {
        setVerifyingFace(false);
      }
    }
  };

  const handleShiftStart = async (type: ShiftType) => {
    if (!userProfile?.reference_photo_url) {
      toast.error("Trebuie să înregistrezi o poză de referință înainte de a pontare");
      setShowEnrollment(true);
      return;
    }

    if (!locationEnabled) {
      toast.error("Locația nu este activată");
      return;
    }
    
    // Request selfie first
    setPendingShiftType(type);
    setPendingSelfieAction('clock-in');
    setShowSelfieCapture(true);
  };

  const performClockIn = async (photoDataUrl: string) => {
    const type = pendingShiftType;
    
    try {
      // Get current location
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      // Fetch active work locations
      const { data: locations, error: locError } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true);

      if (locError) throw locError;

      if (!locations || locations.length === 0) {
        toast.error("Nu există locații de lucru configurate");
        return;
      }

      // Find nearest valid location
      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        return;
      }

      // Get device info
      const deviceId = generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      const ipAddress = await getClientIP();

      // Create time entry with security info
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .insert([{
          user_id: user?.id,
          clock_in_time: new Date().toISOString(),
          clock_in_latitude: currentCoords.latitude,
          clock_in_longitude: currentCoords.longitude,
          clock_in_location_id: nearestLocation.id,
          clock_in_photo_url: photoDataUrl,
          device_id: deviceId,
          device_info: deviceInfo,
          ip_address: ipAddress,
          notes: `Tip: ${getShiftTypeLabel(type)}`
        }])
        .select()
        .single();

      if (entryError) throw entryError;

      setActiveTimeEntry(entry);
      setActiveShift(type);
      setShiftSeconds(0);
      toast.success(`Pontaj început la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      
    } catch (error: any) {
      console.error('Failed to start shift:', error);
      toast.error(error.message || "Eroare la începerea pontajului");
    } finally {
      setPendingSelfieAction(null);
      setPendingShiftType(null);
      setShowSelfieCapture(false);
    }
  };

  const handleShiftEnd = async () => {
    if (!activeTimeEntry) {
      toast.error("Nu există pontaj activ");
      return;
    }

    if (!locationEnabled) {
      toast.error("Locația nu este activată");
      return;
    }

    // Request selfie for clock-out
    setPendingSelfieAction('clock-out');
    setShowSelfieCapture(true);
  };

  const performClockOut = async (photoDataUrl: string) => {
    try {
      // Get current location
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      // Fetch active work locations
      const { data: locations, error: locError } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true);

      if (locError) throw locError;

      if (!locations || locations.length === 0) {
        toast.error("Nu există locații de lucru configurate");
        return;
      }

      // Find nearest valid location
      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        return;
      }

      const clockInTime = activeTimeEntry.clock_in_time;
      const clockOutTime = new Date().toISOString();

      // Update time entry with clock-out photo
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_out_time: clockOutTime,
          clock_out_latitude: currentCoords.latitude,
          clock_out_longitude: currentCoords.longitude,
          clock_out_location_id: nearestLocation.id,
          clock_out_photo_url: photoDataUrl,
        })
        .eq('id', activeTimeEntry.id);

      if (updateError) throw updateError;

      // Calculate time segments automatically
      try {
        await supabase.functions.invoke('calculate-time-segments', {
          body: {
            time_entry_id: activeTimeEntry.id,
            clock_in_time: clockInTime,
            clock_out_time: clockOutTime
          }
        });
      } catch (segmentError) {
        console.error('Failed to calculate segments:', segmentError);
        // Don't fail the clock-out if segment calculation fails
      }

      toast.success(`Pontaj terminat la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      setActiveShift(null);
      setShiftSeconds(0);
      setActiveTimeEntry(null);
      setClockInPhoto(null);
      
    } catch (error: any) {
      console.error('Failed to end shift:', error);
      toast.error(error.message || "Eroare la terminarea pontajului");
    } finally {
      setPendingSelfieAction(null);
      setShowSelfieCapture(false);
    }
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
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/vacations')}>
                  <CalendarDays className="h-4 w-4" />
                  Concedii
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
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{locationError}</span>
                </div>
                <Button variant="outline" size="sm" onClick={requestLocationAccess}>
                  Reîncearcă
                </Button>
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
              className="rounded-md border w-full pointer-events-auto"
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

      {/* Selfie Capture Modal */}
      <SelfieCapture
        open={showSelfieCapture && !verifyingFace}
        onClose={() => {
          setShowSelfieCapture(false);
          setPendingSelfieAction(null);
          setPendingShiftType(null);
        }}
        onCapture={handleSelfieCapture}
        title={pendingSelfieAction === 'clock-in' ? 'Selfie la Intrare' : 'Selfie la Ieșire'}
      />

      {/* Photo Enrollment Modal */}
      {user && (
        <PhotoEnrollment
          open={showEnrollment}
          onClose={() => setShowEnrollment(false)}
          onSuccess={() => {
            setShowEnrollment(false);
            loadUserProfile();
          }}
          userId={user.id}
        />
      )}

      {/* Verification Loading Overlay */}
      {verifyingFace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-8 rounded-lg shadow-xl text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-medium">Verificare facială în curs...</p>
            <p className="text-sm text-muted-foreground mt-2">Așteaptă câteva secunde</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mobile;
