import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WeekNumberCalendar } from "@/components/ui/week-number-calendar";
import { Menu, Clock, LogOut, Car, Users, Briefcase, CheckCircle2, FolderOpen, CalendarDays, Construction, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, addMonths, subMonths } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCurrentPosition, findNearestLocation } from "@/lib/geolocation";
import { generateDeviceFingerprint, getDeviceInfo, getClientIP } from "@/lib/deviceFingerprint";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
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
import { useNavigate } from 'react-router-dom';
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useSafeArea } from "@/hooks/useSafeArea";
import { useAutoDarkMode } from "@/hooks/useAutoDarkMode";
import { RomaniaTimeClock } from "@/components/RomaniaTimeClock";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRealtimeTimeEntries } from "@/hooks/useRealtimeTimeEntries";
import { EmployeeScheduleView } from "@/components/EmployeeScheduleView";
import { ScheduleNotificationBell } from "@/components/ScheduleNotificationBell";
import { LocationPermissionsGuide } from "@/components/LocationPermissionsGuide";
import { MobileHeader } from "@/components/MobileHeader";

type ShiftType = "condus" | "pasager" | "normal" | null;

interface DayData {
  date: Date;
  normalHours: number;
  condusHours: number;
  pasagerHours: number;
}

// Removed mock data - use real data from DB

const Mobile = () => {
  const { user, signOut, loading } = useAuth();
  const [activeShift, setActiveShift] = useState<ShiftType>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [activeTimeEntry, setActiveTimeEntry] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; newType: ShiftType }>({ open: false, newType: null });
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [equipmentPhoto, setEquipmentPhoto] = useState<string | null>(null);
  
  const safeArea = useSafeArea();
  const { triggerHaptic } = useHapticFeedback();
  useAutoDarkMode(); // Auto switch theme based on time of day
  useRealtimeTimeEntries(true); // Real-time updates pentru pontaje

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
    } catch (e: any) {
      setLocationEnabled(false);
      const errorMessage = e.code === 1 
        ? "🚫 Accesul la locație refuzat.\n\n📱 Android: Setări → Aplicații → Chrome → Permisiuni → Locație → Permite\n📱 iPhone: Settings → Privacy → Location Services → Safari → While Using" 
        : e.code === 2
        ? "📍 GPS-ul nu funcționează.\n\nActivează GPS-ul din setări și încearcă din nou."
        : e.code === 3
        ? "⏱️ Timeout la GPS.\n\nVerifică că ești într-o zonă cu semnal bun și încearcă din nou."
        : "❌ Locație indisponibilă.\n\nActivează GPS-ul și permite accesul la locație.";
      setLocationError(errorMessage);
      triggerHaptic('error');
    }
  }, [triggerHaptic]);

  useEffect(() => {
    requestLocationAccess();
  }, [requestLocationAccess]);

  // Check for active shift on mount (after auth is ready)
  useEffect(() => {
    const checkActiveShift = async () => {
      if (loading || !user?.id) {
        console.debug('[Mobile] skip checkActiveShift', { loading, hasUser: !!user });
        return;
      }
      console.debug('[Mobile] checkActiveShift start', { userId: user.id });

      try {
        const { data: activeEntry, error } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('clock_out_time', null)
          .order('clock_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('[Mobile] Active entry fetch error:', error);
          return;
        }

        console.debug('[Mobile] activeEntry', { hasActive: !!activeEntry });
        if (activeEntry) {
          const notesMatch = activeEntry.notes?.match(/Tip: (Condus|Pasager|Normal)/i);
          const shiftType = notesMatch ? (notesMatch[1].toLowerCase() as ShiftType) : 'normal';

          const clockInTime = new Date(activeEntry.clock_in_time).getTime();
          const elapsedSeconds = Math.floor((Date.now() - clockInTime) / 1000);

          setActiveTimeEntry(activeEntry);
          setActiveShift(shiftType);
          setShiftSeconds(elapsedSeconds);
        } else {
          setActiveShift(null);
          setActiveTimeEntry(null);
          setShiftSeconds(0);
        }
      } catch (error) {
        console.error('[Mobile] Failed to check active shift:', error);
      }
    };

    checkActiveShift();
  }, [user?.id, loading]);

  // Cronometru optimizat - se oprește când pagina nu e vizibilă
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let isPageVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      
      // Când pagina devine vizibilă din nou, recalculează timpul
      if (isPageVisible && activeShift && activeTimeEntry) {
        const clockInTime = new Date(activeTimeEntry.clock_in_time).getTime();
        const elapsedSeconds = Math.floor((Date.now() - clockInTime) / 1000);
        setShiftSeconds(elapsedSeconds);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (activeShift) {
      interval = setInterval(() => {
        // Update doar când pagina e vizibilă
        if (isPageVisible) {
          setShiftSeconds((prev) => prev + 1);
        }
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeShift, activeTimeEntry]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleShiftStart = useCallback(async (type: ShiftType, skipConfirmation: boolean = false) => {
    if (isProcessing) return;
    
    if (!locationEnabled) {
      toast.error("📍 GPS-ul nu este activ!\n\nActivează GPS-ul din setări telefon și permite accesul la locație.", {
        duration: 5000,
      });
      triggerHaptic('error');
      return;
    }

    // If there's an active shift and it's different from the new type, show confirmation dialog
    if (activeShift && activeShift !== type && !skipConfirmation) {
      setConfirmDialog({ open: true, newType: type });
      triggerHaptic('light');
      return;
    }
    
    setIsProcessing(true);
    triggerHaptic('medium');
    
    const previousShiftType = activeShift;
    
    try {
      // Check for any existing active shifts and close them
      const { data: existingEntries } = await supabase
        .from('time_entries')
        .select('id, clock_in_time')
        .eq('user_id', user?.id)
        .is('clock_out_time', null);

      if (existingEntries && existingEntries.length > 0) {
        // Close all existing active shifts and calculate segments
        for (const entry of existingEntries) {
          const clockOutTime = new Date().toISOString();
          await supabase
            .from('time_entries')
            .update({ clock_out_time: clockOutTime })
            .eq('id', entry.id);
          
          // Calculate segments for the closed entry
          try {
            await supabase.functions.invoke('calculate-time-segments', {
              body: {
                time_entry_id: entry.id,
                clock_in_time: entry.clock_in_time,
                clock_out_time: clockOutTime
              }
            });
          } catch (segmentError) {
            console.error('Failed to calculate segments for auto-closed entry:', segmentError);
          }
        }
      }
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

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

      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("📍 Nu ești în apropierea unei locații de lucru.\n\nDistanța maximă permisă poate fi depășită. Verifică că ești la locul de muncă corect.", {
          duration: 6000,
        });
        triggerHaptic('error');
        return;
      }

      const deviceId = generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      const ipAddress = await getClientIP();

      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .insert([{
          user_id: user?.id,
          clock_in_time: new Date().toISOString(),
          clock_in_latitude: currentCoords.latitude,
          clock_in_longitude: currentCoords.longitude,
          clock_in_location_id: nearestLocation.id,
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
      
      // Enhanced toast message for shift changes
      if (previousShiftType && previousShiftType !== type) {
        toast.success(`Tură ${getShiftTypeLabel(previousShiftType)} închisă. Tură ${getShiftTypeLabel(type)} începută la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      } else {
        toast.success(`Pontaj început la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      }
      
    } catch (error: any) {
      console.error('Failed to start shift:', error);
      triggerHaptic('error');
      toast.error(error.message || "Eroare la începerea pontajului");
    } finally {
      setIsProcessing(false);
    }
  }, [locationEnabled, isProcessing, user, triggerHaptic, activeShift]);

  const handleConfirmShiftChange = useCallback(() => {
    setConfirmDialog({ open: false, newType: null });
    if (confirmDialog.newType) {
      handleShiftStart(confirmDialog.newType, true);
    }
  }, [confirmDialog.newType, handleShiftStart]);

  const handleCancelShiftChange = useCallback(() => {
    setConfirmDialog({ open: false, newType: null });
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Users allowed to use equipment button
  const EQUIPMENT_USERS = ['ababeiciprian', 'costachemarius', 'costacheflorin', 'rusugheorghita'];
  const canUseEquipment = user?.user_metadata?.username && 
    EQUIPMENT_USERS.includes(user.user_metadata.username.toLowerCase());
  
  // Equipment access check

  const handleEquipmentStart = useCallback(async () => {
    if (!activeTimeEntry) {
      toast.error("Nu există pontaj activ pentru a marca condus utilaj");
      triggerHaptic('error');
      return;
    }

    if (!equipmentPhoto) {
      toast.error("Poza cu utilajul este obligatorie");
      triggerHaptic('error');
      return;
    }

    setEquipmentDialog(false);
    triggerHaptic('success');

    try {
      let photoUrl = null;

      // Upload photo if present
      if (equipmentPhoto) {
        try {
          const base64Data = equipmentPhoto.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });

          const fileName = `equipment_${activeTimeEntry.id}_${Date.now()}.jpg`;
          const filePath = `${user?.id}/${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(filePath, blob);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(filePath);

          photoUrl = publicUrl;
        } catch (uploadErr) {
          toast.error("Eroare la încărcarea pozei");
        }
      }

      // Update time entry with equipment marker
      const currentNotes = activeTimeEntry.notes || '';
      const photoNote = photoUrl ? ` [Poză: ${photoUrl}]` : '';
      const updatedNotes = currentNotes.includes('Condus Utilaj') 
        ? currentNotes 
        : `${currentNotes} | Condus Utilaj${photoNote}`.trim();

      const { data: updateData, error: updateError } = await supabase
        .from('time_entries')
        .update({ 
          notes: updatedNotes,
        })
        .eq('id', activeTimeEntry.id)
        .select();

      if (updateError) throw updateError;

      // Update local state
      setActiveTimeEntry({ ...activeTimeEntry, notes: updatedNotes });
      setEquipmentPhoto(null);
      
      toast.success("Condus Utilaj marcat cu succes!");
    } catch (error: any) {
      toast.error("Eroare la marcarea utilajului");
      triggerHaptic('error');
    }
  }, [activeTimeEntry, equipmentPhoto, user, triggerHaptic]);

  const handleEquipmentPhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEquipmentPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleShiftEnd = useCallback(async () => {
    if (isProcessing) return;
    
    if (!activeTimeEntry) {
      toast.error("Nu există pontaj activ");
      triggerHaptic('error');
      return;
    }

    if (!locationEnabled) {
      toast.error("📍 GPS-ul nu este activ!\n\nActivează GPS-ul pentru a termina pontajul.", {
        duration: 5000,
      });
      triggerHaptic('error');
      return;
    }

    setIsProcessing(true);
    triggerHaptic('medium');
    
    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

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

      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("📍 Nu ești în apropierea unei locații de lucru.\n\nAsigură-te că ești la locația de lucru înainte de a termina pontajul.", {
          duration: 6000,
        });
        triggerHaptic('error');
        return;
      }

      const clockInTime = activeTimeEntry.clock_in_time;
      const clockOutTime = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_out_time: clockOutTime,
          clock_out_latitude: currentCoords.latitude,
          clock_out_longitude: currentCoords.longitude,
          clock_out_location_id: nearestLocation.id,
        })
        .eq('id', activeTimeEntry.id);

      if (updateError) throw updateError;

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
      }

      triggerHaptic('success');
      toast.success(`Pontaj terminat la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      setActiveShift(null);
      setShiftSeconds(0);
      setActiveTimeEntry(null);
      
    } catch (error: any) {
      console.error('Failed to end shift:', error);
      triggerHaptic('error');
      toast.error(error.message || "Eroare la terminarea pontajului");
    } finally {
      setIsProcessing(false);
    }
  }, [activeTimeEntry, locationEnabled, isProcessing, triggerHaptic]);

  const getShiftTypeLabel = (type: ShiftType) => {
    switch (type) {
      case "condus": return "Condus";
      case "pasager": return "Pasager";
      case "normal": return "Normal";
      default: return "";
    }
  };

  // Removed unused mock data functions

  const formattedTime = useMemo(() => formatTime(shiftSeconds), [shiftSeconds]);

  return (
    <div className="min-h-screen bg-mesh pb-safe-area-bottom">
      <MobileHeader safeAreaTop={safeArea.top} />

      <main className="p-3 xs:p-4 space-y-3 xs:space-y-4 smooth-scroll">
        {!locationEnabled && locationError && (
          <Card className="glass-card border-destructive/30 glow-primary animate-slide-up-fade">
            <CardContent className="p-3 xs:p-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 animate-glow-pulse" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-responsive-xs font-semibold">{locationError}</span>
                </div>
                <Button 
                  variant="glass" 
                  size="sm" 
                  onClick={requestLocationAccess} 
                  className="touch-target w-full xs:w-auto hover:scale-105"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Se verifică..." : "Reîncearcă"}
                </Button>
                <LocationPermissionsGuide 
                  trigger={
                    <Button variant="outline" size="sm" className="touch-target">
                      Ghid Setări
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 xs:space-y-3 animate-slide-up-fade mb-3">
          {activeShift && (
            <>
              <div className="flex items-center gap-2 text-primary">
                <Clock className="h-5 w-5 animate-spin" />
                <h3 className="text-responsive-lg font-bold">Tură Activă</h3>
              </div>
              
              <div className="font-black tracking-wider tabular-nums text-responsive-2xl bg-gradient-primary-action bg-clip-text text-transparent">
                {formattedTime}
              </div>
              
              <div className="flex items-center gap-2 text-responsive-sm font-semibold text-primary">
                {activeShift === "condus" && <Car className="h-5 w-5 animate-float" />}
                {activeShift === "pasager" && <Users className="h-5 w-5 animate-float" />}
                {activeShift === "normal" && <Briefcase className="h-5 w-5 animate-float" />}
                <span>
                  Tip: {getShiftTypeLabel(activeShift)}
                  {activeTimeEntry?.notes?.includes('Condus Utilaj') && (
                    <span className="ml-1 text-warning">+ Utilaj</span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        <Card className="glass-card elevated-card border-primary/10 animate-slide-up-fade" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-4 xs:p-6">
            <div className="grid grid-cols-1 gap-2 xs:gap-3">
              <Button
                size="lg"
                onClick={() => handleShiftStart("condus")}
                disabled={!locationEnabled || isProcessing}
                className={`touch-target-lg no-select h-16 xs:h-18 text-responsive-sm font-bold bg-gradient-to-r from-info to-primary hover:from-primary hover:to-info text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all duration-300 hover:scale-105 active:scale-95 shadow-glow ${activeShift === "condus" ? "ring-4 ring-info/50 ring-offset-2" : ""}`}
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Car className="h-6 w-6 xs:h-7 xs:w-7" />
                    INTRARE CONDUS
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("pasager")}
                disabled={!locationEnabled || isProcessing}
                className={`touch-target-lg no-select h-16 xs:h-18 text-responsive-sm font-bold bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all duration-300 hover:scale-105 active:scale-95 shadow-glow ${activeShift === "pasager" ? "animate-glow-pulse ring-4 ring-success/50 ring-offset-2" : ""}`}
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Users className="h-6 w-6 xs:h-7 xs:w-7" />
                    INTRARE PASAGER
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("normal")}
                disabled={!locationEnabled || isProcessing}
                className={`touch-target-lg no-select h-16 xs:h-18 text-responsive-sm font-bold bg-gradient-accent-action hover:brightness-110 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all duration-300 hover:scale-105 active:scale-95 shadow-glow ${activeShift === "normal" ? "animate-glow-pulse ring-4 ring-accent/50 ring-offset-2" : ""}`}
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Briefcase className="h-6 w-6 xs:h-7 xs:w-7" />
                    INTRARE NORMAL
                  </>
                )}
              </Button>
              
              {activeShift && canUseEquipment && (
                <Button
                  size="lg"
                  onClick={() => setEquipmentDialog(true)}
                  disabled={isProcessing}
                  className="touch-target-lg no-select h-16 xs:h-18 text-responsive-sm font-bold bg-gradient-to-r from-warning to-warning/80 hover:from-warning/90 hover:to-warning text-white flex items-center justify-center gap-2 xs:gap-3 transition-all duration-300 hover:scale-105 active:scale-95 shadow-glow animate-glow-pulse"
                >
                  <Construction className="h-6 w-6 xs:h-7 xs:w-7" />
                  CONDUS UTILAJ
                </Button>
              )}
              
              {activeShift && (
                <Button
                  size="lg"
                  onClick={handleShiftEnd}
                  disabled={isProcessing}
                  className="touch-target-lg no-select h-16 xs:h-18 text-responsive-sm font-bold bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive text-white flex items-center justify-center gap-2 xs:gap-3 transition-all duration-300 hover:scale-105 active:scale-95 mt-2 shadow-glow"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Se procesează...
                    </>
                  ) : (
                    <>
                      <Clock className="h-6 w-6 xs:h-7 xs:w-7" />
                      IEȘIRE
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Employee Schedule */}
        <EmployeeScheduleView />

        {/* Monthly Calendar */}
        <Card className="glass-card elevated-card border-primary/10 animate-slide-up-fade" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-responsive-lg font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Calendar Lunar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 xs:space-y-4">
            <div className="touch-manipulation">
              <WeekNumberCalendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(date)}
                locale={ro}
                className="rounded-md border w-full"
              />
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-3 xs:gap-4 text-responsive-xs font-semibold">
              <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full border-accent/20">
                <div className="w-3 h-3 xs:w-4 xs:h-4 rounded-full bg-gradient-accent-action shadow-sm"></div>
                <span className="text-foreground">Ore Normale</span>
              </div>
              <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full border-info/20">
                <div className="w-3 h-3 xs:w-4 xs:h-4 rounded-full bg-gradient-to-r from-info to-primary shadow-sm"></div>
                <span className="text-foreground">Ore Condus</span>
              </div>
              <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full border-success/20">
                <div className="w-3 h-3 xs:w-4 xs:h-4 rounded-full bg-success shadow-sm"></div>
                <span className="text-foreground">Ore Pasager</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && handleCancelShiftChange()}>
        <AlertDialogContent className="glass-card border-primary/20 animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
              <Clock className="h-6 w-6" />
              Schimbare Regim Tură
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              Ai o tură activă de tip <strong className="text-primary">{getShiftTypeLabel(activeShift)}</strong>. 
              Vrei să o închizi și să începi o tură nouă de tip <strong className="text-accent">{getShiftTypeLabel(confirmDialog.newType)}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={handleCancelShiftChange} className="glass-button">Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmShiftChange} className="bg-gradient-primary-action hover:scale-105">Confirmă Schimbarea</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Equipment Confirmation Dialog */}
      <AlertDialog open={equipmentDialog} onOpenChange={setEquipmentDialog}>
        <AlertDialogContent className="glass-card border-warning/30 max-w-md animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning text-xl font-bold">
              <Construction className="h-6 w-6 animate-float" />
              Confirmare Condus Utilaj
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p className="text-base font-medium">
                Ești pe cale să marchezi <strong className="text-warning">Condus Utilaj</strong> pentru pontajul curent.
              </p>
              <div className="glass-card border-warning/30 rounded-xl p-4 glow-accent">
                <p className="text-sm font-bold mb-2 text-warning flex items-center gap-1">
                  ⚠️ Atenție
                </p>
                <p className="text-sm leading-relaxed">
                  Această acțiune va marca pontajul ca fiind efectuat cu utilaj de construcție. 
                  Asigură-te că utilizezi utilajul înainte de a confirma.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Poză utilaj <span className="text-destructive font-semibold">(obligatoriu)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleEquipmentPhotoCapture}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
                {equipmentPhoto && (
                  <div className="mt-2">
                    <img 
                      src={equipmentPhoto} 
                      alt="Equipment" 
                      className="w-full h-32 object-cover rounded-md border"
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setEquipmentDialog(false);
              setEquipmentPhoto(null);
            }}>
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleEquipmentStart}
              disabled={!equipmentPhoto}
              className="bg-gradient-to-r from-orange-500 to-yellow-600 hover:from-orange-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!equipmentPhoto ? "Încarcă o poză cu utilajul pentru a continua" : ""}
            >
              <Construction className="h-4 w-4 mr-2" />
              Confirmă Utilaj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Mobile;
