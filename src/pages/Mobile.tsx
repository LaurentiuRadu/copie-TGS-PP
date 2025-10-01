import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Menu, Clock, LogOut, Car, Users, Briefcase, CheckCircle2, FolderOpen, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
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
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useSafeArea } from "@/hooks/useSafeArea";

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const safeArea = useSafeArea();
  const { triggerHaptic } = useHapticFeedback();

  // Swipe gesture for calendar navigation
  useSwipeGesture({
    onSwipeLeft: useCallback(() => {
      setSelectedMonth(prev => addMonths(prev, 1));
      triggerHaptic('light');
    }, [triggerHaptic]),
    onSwipeRight: useCallback(() => {
      setSelectedMonth(prev => subMonths(prev, 1));
      triggerHaptic('light');
    }, [triggerHaptic]),
    threshold: 75
  });

  const requestLocationAccess = useCallback(async () => {
    try {
      setLocationError(null);
      await getCurrentPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
      setLocationEnabled(true);
      triggerHaptic('light');
    } catch (e) {
      setLocationEnabled(false);
      setLocationError("Permisiunea pentru locație a fost refuzată sau indisponibilă");
      triggerHaptic('error');
    }
  }, [triggerHaptic]);

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
      triggerHaptic('error');
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
          triggerHaptic('error');
          setVerifyingFace(false);
          return;
        }

        triggerHaptic('success');
        toast.success(`Verificare reușită (${verifyData.confidence}% încredere)`);
        setClockInPhoto(photoDataUrl);
        performClockIn(photoDataUrl);
      } catch (error) {
        console.error('Face verification error:', error);
        toast.error("Eroare la verificarea facială. Încearcă din nou.");
        triggerHaptic('error');
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
          triggerHaptic('error');
          setVerifyingFace(false);
          return;
        }

        triggerHaptic('success');
        toast.success(`Verificare reușită (${verifyData.confidence}% încredere)`);
        performClockOut(photoDataUrl);
      } catch (error) {
        console.error('Face verification error:', error);
        toast.error("Eroare la verificarea facială. Încearcă din nou.");
        triggerHaptic('error');
      } finally {
        setVerifyingFace(false);
      }
    }
  };

  const handleShiftStart = useCallback(async (type: ShiftType) => {
    if (!userProfile?.reference_photo_url) {
      toast.error("Trebuie să înregistrezi o poză de referință înainte de a pontare");
      setShowEnrollment(true);
      triggerHaptic('warning');
      return;
    }

    if (!locationEnabled) {
      toast.error("Locația nu este activată");
      triggerHaptic('error');
      return;
    }
    
    triggerHaptic('medium');
    // Request selfie first
    setPendingShiftType(type);
    setPendingSelfieAction('clock-in');
    setShowSelfieCapture(true);
  }, [userProfile, locationEnabled, triggerHaptic]);

  const performClockIn = async (photoDataUrl: string) => {
    const type = pendingShiftType;
    
    try {
      triggerHaptic('medium');
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
        triggerHaptic('error');
        return;
      }

      // Find nearest valid location
      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        triggerHaptic('error');
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
      triggerHaptic('success');
      toast.success(`Pontaj început la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      
    } catch (error: any) {
      console.error('Failed to start shift:', error);
      triggerHaptic('error');
      toast.error(error.message || "Eroare la începerea pontajului");
    } finally {
      setPendingSelfieAction(null);
      setPendingShiftType(null);
      setShowSelfieCapture(false);
    }
  };

  const handleShiftEnd = useCallback(async () => {
    if (!activeTimeEntry) {
      toast.error("Nu există pontaj activ");
      triggerHaptic('error');
      return;
    }

    if (!locationEnabled) {
      toast.error("Locația nu este activată");
      triggerHaptic('error');
      return;
    }

    triggerHaptic('medium');
    // Request selfie for clock-out
    setPendingSelfieAction('clock-out');
    setShowSelfieCapture(true);
  }, [activeTimeEntry, locationEnabled, triggerHaptic]);

  const handleResetReferencePhoto = async () => {
    try {
      triggerHaptic('warning');
      
      const { error } = await supabase
        .from('profiles')
        .update({
          reference_photo_url: null,
          photo_quality_score: null,
          reference_photo_enrolled_at: null
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Refresh user profile
      await loadUserProfile();
      
      toast.success("Poza de referință a fost resetată. Poți reface enrollment-ul.");
      triggerHaptic('success');
    } catch (error) {
      console.error('Error resetting reference photo:', error);
      toast.error("Eroare la resetarea pozei");
      triggerHaptic('error');
    }
  };

  const performClockOut = async (photoDataUrl: string) => {
    try {
      triggerHaptic('medium');
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
        triggerHaptic('error');
        return;
      }

      // Find nearest valid location
      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        triggerHaptic('error');
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

      triggerHaptic('success');
      toast.success(`Pontaj terminat la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      setActiveShift(null);
      setShiftSeconds(0);
      setActiveTimeEntry(null);
      setClockInPhoto(null);
      
    } catch (error: any) {
      console.error('Failed to end shift:', error);
      triggerHaptic('error');
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

  // Memoize expensive calculations
  const formattedTime = useMemo(() => formatTime(shiftSeconds), [shiftSeconds]);

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <header 
        className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border"
        style={{ paddingTop: `${safeArea.top}px` }}
      >
        <div className="flex items-center justify-between p-3 xs:p-4">
          <div className="flex items-center gap-2 xs:gap-3 min-w-0">
            <div className="flex h-8 w-8 xs:h-10 xs:w-10 items-center justify-center rounded-lg bg-primary flex-shrink-0">
              <Clock className="h-4 w-4 xs:h-6 xs:w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-responsive-base font-bold text-foreground truncate">TimeTrack</h1>
              <p className="text-responsive-xs text-muted-foreground truncate">{user?.user_metadata?.full_name || user?.email}</p>
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-target no-select flex-shrink-0">
                <Menu className="h-5 w-5 xs:h-6 xs:w-6" />
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
                  className="w-full justify-start gap-2 text-orange-500 hover:text-orange-600"
                  onClick={handleResetReferencePhoto}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Resetează Poza Referință
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

      <main className="p-3 xs:p-4 space-y-3 xs:space-y-4 smooth-scroll">
        {/* Location Warning */}
        {!locationEnabled && locationError && (
          <Card className="border-destructive bg-destructive/10 animate-slide-down">
            <CardContent className="p-3 xs:p-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-responsive-xs font-medium">{locationError}</span>
                </div>
                <Button variant="outline" size="sm" onClick={requestLocationAccess} className="touch-target w-full xs:w-auto">
                  Reîncearcă
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Shift Card */}
        <Card className={`shadow-custom-lg transition-all duration-300 ${activeShift ? "bg-gradient-primary" : "bg-card"}`}>
          <CardHeader className="pb-2 xs:pb-3">
            <CardTitle className={`text-responsive-lg ${activeShift ? "text-white" : "text-foreground"}`}>
              {activeShift ? "Tură Activă" : "Nicio tură activă"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 xs:space-y-3">
            <div className={`text-responsive-2xl font-bold tracking-wider tabular-nums ${activeShift ? "text-white animate-pulse-soft" : "text-muted-foreground"}`}>
              {formattedTime}
            </div>
            {activeShift && (
              <div className={`flex items-center gap-2 text-responsive-sm ${activeShift ? "text-white/90" : "text-muted-foreground"}`}>
                {activeShift === "condus" && <Car className="h-4 w-4" />}
                {activeShift === "pasager" && <Users className="h-4 w-4" />}
                {activeShift === "normal" && <Briefcase className="h-4 w-4" />}
                <span>Tip: {getShiftTypeLabel(activeShift)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shift Controls */}
        <Card className="shadow-custom-lg">
          <CardContent className="p-4 xs:p-6">
            <div className="grid grid-cols-1 gap-2 xs:gap-3">
              <Button
                size="lg"
                onClick={() => handleShiftStart("condus")}
                disabled={!locationEnabled || activeShift !== null}
                className="touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95"
              >
                <Car className="h-5 w-5 xs:h-6 xs:w-6" />
                INTRARE CONDUS
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("pasager")}
                disabled={!locationEnabled || activeShift !== null}
                className="touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95"
              >
                <Users className="h-5 w-5 xs:h-6 xs:w-6" />
                INTRARE PASAGER
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("normal")}
                disabled={!locationEnabled || activeShift !== null}
                className="touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95"
              >
                <Briefcase className="h-5 w-5 xs:h-6 xs:w-6" />
                INTRARE
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleShiftEnd}
                disabled={!activeShift}
                className="touch-target no-select h-14 xs:h-16 text-responsive-sm font-semibold transition-all active:scale-95"
              >
                IEȘIRE
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Calendar */}
        <Card className="shadow-custom-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-responsive-lg flex items-center justify-between">
              <span>Calendar Lunar</span>
              <Badge variant="outline" className="text-responsive-xs">
                Swipe ← →
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 xs:space-y-4">
            <div className="touch-manipulation">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(date)}
                locale={ro}
                className="rounded-md border w-full"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-responsive-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 touch-target",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 touch-target",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md touch-target",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
                }}
                modifiers={{
                  condus: mockMonthData.filter(d => d.condusHours > 0).map(d => d.date),
                  pasager: mockMonthData.filter(d => d.pasagerHours > 0).map(d => d.date),
                  normal: mockMonthData.filter(d => d.normalHours > 0).map(d => d.date),
                }}
                modifiersClassNames={{
                  condus: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-900 dark:text-blue-100 font-semibold",
                  pasager: "bg-green-500/20 hover:bg-green-500/30 text-green-900 dark:text-green-100 font-semibold",
                  normal: "bg-purple-500/20 hover:bg-purple-500/30 text-purple-900 dark:text-purple-100 font-semibold",
                }}
              />
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-3 xs:gap-4 text-responsive-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 xs:w-4 xs:h-4 rounded bg-purple-500/30"></div>
                <span className="text-muted-foreground">Ore Normale</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 xs:w-4 xs:h-4 rounded bg-blue-500/30"></div>
                <span className="text-muted-foreground">Ore Condus</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 xs:w-4 xs:h-4 rounded bg-green-500/30"></div>
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
          triggerHaptic('light');
        }}
        onCapture={handleSelfieCapture}
        title={pendingSelfieAction === 'clock-in' ? 'Selfie la Intrare' : 'Selfie la Ieșire'}
      />

      {/* Photo Enrollment Modal */}
      {user && (
        <PhotoEnrollment
          open={showEnrollment}
          onClose={() => {
            setShowEnrollment(false);
            triggerHaptic('light');
          }}
          onSuccess={() => {
            setShowEnrollment(false);
            loadUserProfile();
            triggerHaptic('success');
            toast.success("Poză de referință înregistrată cu succes!");
          }}
          userId={user.id}
        />
      )}

      {/* Verification Loading Overlay */}
      {verifyingFace && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm animate-slide-up">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-pulse-soft">
                  <Clock className="h-12 w-12 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-responsive-lg font-semibold">Verificare facială...</h3>
                  <p className="text-responsive-sm text-muted-foreground">
                    Te rugăm să aștepți în timp ce verificăm identitatea
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Mobile;
