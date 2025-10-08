import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Menu, Clock, LogOut, Car, Users, Briefcase, CalendarDays } from "lucide-react";
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
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useSafeArea } from "@/hooks/useSafeArea";
import { useAutoDarkMode } from "@/hooks/useAutoDarkMode";
import { useRealtimeTimeEntries } from "@/hooks/useRealtimeTimeEntries";
import { EmployeeScheduleView } from "@/components/EmployeeScheduleView";
import { useActiveTimeEntry } from "@/hooks/useActiveTimeEntry";
import { AdminLayout } from "@/components/AdminLayout";
import { TardinessReasonDialog } from "@/components/TardinessReasonDialog";
import { ClockOutReminderAlert } from "@/components/ClockOutReminderAlert";
import { useTardinessCheck } from "@/hooks/useTardinessCheck";

import { ClockInConfirmationCard } from "@/components/ClockInConfirmationCard";
import { ClockConfirmationDialog } from "@/components/ClockConfirmationDialog";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { useQuery } from "@tanstack/react-query";

type ShiftType = "condus" | "pasager" | "normal" | "utilaj" | null;

interface DayData {
  date: Date;
  normalHours: number;
  condusHours: number;
  pasagerHours: number;
}

const mockMonthData: DayData[] = [
  { date: new Date(2025, 0, 2), normalHours: 8, condusHours: 0, pasagerHours: 0 },
  { date: new Date(2025, 0, 3), normalHours: 0, condusHours: 7, pasagerHours: 0 },
  { date: new Date(2025, 0, 6), normalHours: 0, condusHours: 0, pasagerHours: 8 },
  { date: new Date(2025, 0, 7), normalHours: 8, condusHours: 0, pasagerHours: 0 },
  { date: new Date(2025, 0, 8), normalHours: 0, condusHours: 6, pasagerHours: 0 },
];

import { Battery } from "lucide-react";
import { useBatteryOptimization } from "@/hooks/useBatteryOptimization";

const Mobile = () => {
  const { user, signOut, loading } = useAuth();
  const [activeShift, setActiveShift] = useState<ShiftType>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>({});
  const [lastShiftType, setLastShiftType] = useState<ShiftType>(null);
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [activeTimeEntry, setActiveTimeEntry] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; newType: ShiftType }>({ open: false, newType: null });
  const [tardinessDialog, setTardinessDialog] = useState<{ open: boolean; delayMinutes: number; scheduledTime: string } | null>(null);
  const [showReminderAlert, setShowReminderAlert] = useState(true);
  const [pendingTardinessEntry, setPendingTardinessEntry] = useState<any>(null);
  const [confirmationCard, setConfirmationCard] = useState<{
    show: boolean;
    type: "clock-in" | "clock-out";
    timestamp: string;
    locationName: string;
    locationDistance: number;
    latitude: number;
    longitude: number;
    shiftType?: string;
  } | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [preClockDialog, setPreClockDialog] = useState<{
    open: boolean;
    type: "clock-in" | "clock-out";
    shiftType: string;
    originalShiftType?: ShiftType;
    location: { name: string; address?: string } | null;
  } | null>(null);
  
  const safeArea = useSafeArea();
  const { triggerHaptic } = useHapticFeedback();
  const { batteryInfo } = useBatteryOptimization();
  useAutoDarkMode(); // Auto switch theme based on time of day
  useRealtimeTimeEntries(true); // Real-time updates pentru pontaje
  
  // Monitor active time entry for notifications
  const { hasActiveEntry, activeEntry: monitoredEntry, elapsed: monitoredElapsed } = useActiveTimeEntry(user?.id);
  
  // Check for tardiness when clocking in
  const tardinessInfo = useTardinessCheck(user?.id, !activeShift);

  const requestLocationAccess = useCallback(async () => {
    let loadingToast: string | number | undefined;
    try {
      setLocationError(null);
      loadingToast = toast.info('Se caută GPS... Poate dura până la 15 secunde.', { duration: Infinity });
      await getCurrentPosition({ 
        enableHighAccuracy: true, 
        timeout: 15000,
        maximumAge: 0,
        maxRetries: 3,
        retryDelay: 1000
      });
      setLocationEnabled(true);
      triggerHaptic('light');
      if (loadingToast) toast.dismiss(loadingToast);
      toast.success('Locație GPS găsită!', { duration: 2000 });
    } catch (e: any) {
      if (loadingToast) toast.dismiss(loadingToast);
      setLocationEnabled(false);
      const errorMessage = e.code === 1 
        ? "Accesul la locație a fost refuzat. Activează permisiunile GPS." 
        : e.code === 2
        ? "Nu s-a putut determina locația. Verifică conexiunea GPS și încearcă din nou."
        : e.code === 3
        ? "Timeout la determinarea locației. Verifică semnalul GPS și încearcă din nou."
        : "Locație indisponibilă";
      setLocationError(errorMessage);
      triggerHaptic('error');
    }
  }, [triggerHaptic]);

  // Request location access only ONCE on mount
  useEffect(() => {
    let mounted = true;
    
    const initLocation = async () => {
      if (mounted) {
        await requestLocationAccess();
      }
    };
    
    initLocation();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty deps - run only once on mount

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
          const notesMatch = activeEntry.notes?.match(/Tip: (Condus|Pasager|Normal|Condus Utilaj)/i);
          let shiftType: ShiftType = 'normal';
          if (notesMatch) {
            const typeText = notesMatch[1].toLowerCase();
            if (typeText === 'condus utilaj') {
              shiftType = 'utilaj';
            } else {
              shiftType = typeText as ShiftType;
            }
          }

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

  // Pas 2: Retry logic for time segment processing
  const processTimeSegmentsWithRetry = async (
    userId: string,
    timeEntryId: string,
    clockInTime: string,
    clockOutTime: string,
    notes: string | null,
    maxRetries = 5  // ✅ Crește de la 3 la 5
  ): Promise<boolean> => {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[ProcessSegments] Attempt ${attempt}/${maxRetries} for entry ${timeEntryId}...`);
      
      const { data, error } = await supabase.functions.invoke('calculate-time-segments', {
        body: {
          user_id: userId,
          time_entry_id: timeEntryId,
          clock_in_time: clockInTime,
          clock_out_time: clockOutTime,
          notes
        }
      });
      
      if (!error && data) {
        console.log(`[ProcessSegments] ✅ Success on attempt ${attempt}`, data);
        
        // Clear needs_reprocessing flag on success
        await supabase
          .from('time_entries')
          .update({ 
            needs_reprocessing: false,
            last_reprocess_attempt: new Date().toISOString()
          })
          .eq('id', timeEntryId);
        
        return true;
      }
      
      lastError = error;
      console.error(`[ProcessSegments] ❌ Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // ✅ Exponential backoff mai lung: 2s, 5s, 10s, 20s
        const delayMs = attempt === 1 ? 2000 : 2500 * Math.pow(2, attempt - 2);
        console.log(`[ProcessSegments] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.error(`[ProcessSegments] ❌ All ${maxRetries} attempts failed`);
    
    // ✅ Salvează flag needs_reprocessing
    try {
      await supabase
        .from('time_entries')
        .update({ 
          needs_reprocessing: true,
          last_reprocess_attempt: new Date().toISOString()
        })
        .eq('id', timeEntryId);
      
      // ✅ Log eroarea în audit_logs folosind funcția security definer
      await supabase.rpc('log_client_error', {
        _action: 'time_segment_processing_failed',
        _resource_type: 'time_entry',
        _resource_id: timeEntryId,
        _details: {
          attempts: maxRetries,
          last_error: lastError?.message || String(lastError),
            clock_in_time: clockInTime,
            clock_out_time: clockOutTime
          }
        });
      
      console.log(`[ProcessSegments] 📝 Marked entry ${timeEntryId} for reprocessing`);
    } catch (flagError) {
      console.error(`[ProcessSegments] Failed to set needs_reprocessing flag:`, flagError);
    }
    
    return false;
  };

  const handleShiftStart = useCallback(async (type: ShiftType, skipConfirmation: boolean = false) => {
    if (isProcessing) {
      toast.warning("Așteaptă finalizarea operațiunii anterioare");
      return;
    }

    // Check for duplicate clicks (cooldown 3 seconds)
    const buttonKey = `start-${type}`;
    const now = Date.now();
    const lastClick = lastClickTime[buttonKey] || 0;
    const cooldownMs = 3000; // 3 seconds

    if (now - lastClick < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now - lastClick)) / 1000);
      toast.warning(`Așteaptă ${remainingSeconds}s înainte să pontezi din nou`);
      triggerHaptic('warning');
      return;
    }

    // Check for rapid shift type changes (cooldown 2 seconds between different types)
    if (lastShiftType && lastShiftType !== type && !skipConfirmation) {
      const lastTypeClick = lastClickTime['shift-type-change'] || 0;
      const typeChangeCooldownMs = 2000; // 2 seconds between type changes
      
      if (now - lastTypeClick < typeChangeCooldownMs) {
        const remainingSeconds = Math.ceil((typeChangeCooldownMs - (now - lastTypeClick)) / 1000);
        toast.warning(`Așteaptă ${remainingSeconds}s pentru a schimba tipul de pontaj`);
        triggerHaptic('warning');
        return;
      }
    }

    // Check if same shift type is already active
    if (activeShift === type && !skipConfirmation) {
      toast.warning(`Ai deja o tură ${getShiftTypeLabel(type)} activă`);
      triggerHaptic('warning');
      return;
    }

    setLastClickTime(prev => ({ ...prev, [buttonKey]: now, 'shift-type-change': now }));
    setLastShiftType(type);
    
    if (!locationEnabled) {
      toast.error("Locația nu este activată");
      triggerHaptic('error');
      return;
    }

    // If there's an active shift and it's different from the new type, show confirmation dialog
    if (activeShift && activeShift !== type && !skipConfirmation) {
      setConfirmDialog({ open: true, newType: type });
      triggerHaptic('light');
      return;
    }

    // ✅ AFIȘEAZĂ DIALOG DE CONFIRMARE PRE-PONTAJ
    if (!skipConfirmation) {
      // Get location for preview
      try {
        const position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
          maxRetries: 1,
          retryDelay: 1000
        });
        
        const currentCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const { data: locations } = await supabase
          .from('work_locations')
          .select('*')
          .eq('is_active', true);

        const nearestLocation = locations ? findNearestLocation(currentCoords, locations) : null;

        setPreClockDialog({
          open: true,
          type: "clock-in",
          shiftType: getShiftTypeLabel(type),
          originalShiftType: type,
          location: nearestLocation ? { name: nearestLocation.name, address: nearestLocation.address } : null,
        });
        triggerHaptic('light');
        return;
      } catch (error) {
        // Dacă nu putem obține locația pentru preview, continuăm direct
        console.warn('Could not get location for preview:', error);
      }
    }

    // Continue with actual clock-in
    await actuallyStartShift(type);
  }, [isProcessing, locationEnabled, activeShift, lastClickTime, lastShiftType, user, triggerHaptic]);

  const actuallyStartShift = useCallback(async (type: ShiftType) => {
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
        // Close all existing active shifts
        for (const entry of existingEntries) {
          await supabase
            .from('time_entries')
            .update({ clock_out_time: new Date().toISOString() })
            .eq('id', entry.id);
        }
      }
      let loadingToast: string | number | undefined;
      loadingToast = toast.info('Se obține locația GPS...', { duration: Infinity });
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        maxRetries: 3,
        retryDelay: 1000
      });
      
      if (loadingToast) toast.dismiss(loadingToast);
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      console.log('[ClockIn] GPS location obtained:', { 
        accuracy: position.coords.accuracy,
        coords: currentCoords 
      });

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
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
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
      
      // Check if tardiness needs to be reported
      if (tardinessInfo.isLate && tardinessInfo.scheduledTime) {
        setPendingTardinessEntry(entry);
        setTardinessDialog({
          open: true,
          delayMinutes: tardinessInfo.delayMinutes,
          scheduledTime: tardinessInfo.scheduledTime,
        });
      }
      
      triggerHaptic('success');
      
      // Show confirmation card with details
      setConfirmationCard({
        show: true,
        type: "clock-in",
        timestamp: entry.clock_in_time,
        locationName: nearestLocation.name,
        locationDistance: nearestLocation.distance,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        shiftType: getShiftTypeLabel(type),
      });
      
      // Enhanced toast message for shift changes
      if (previousShiftType && previousShiftType !== type) {
        toast.success(`Tură ${getShiftTypeLabel(previousShiftType)} închisă. Tură ${getShiftTypeLabel(type)} începută`);
      } else {
        toast.success(`Pontaj început cu succes`);
      }
      
    } catch (error: any) {
      console.error('Failed to start shift:', error);
      triggerHaptic('error');
      toast.error(error.message || "Eroare la începerea pontajului");
    } finally {
      setIsProcessing(false);
    }
  }, [user, triggerHaptic, activeShift, tardinessInfo]);

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

  const handleShiftEnd = useCallback(async () => {
    // Verificări preliminare
    if (isProcessing) {
      console.log('[ClockOut] Already processing, ignoring...');
      return;
    }
    
    // Debounce pentru clock-out
    const buttonKey = 'clock-out';
    const now = Date.now();
    const lastClick = lastClickTime[buttonKey] || 0;
    const cooldownMs = 2000; // 2 seconds

    if (now - lastClick < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now - lastClick)) / 1000);
      toast.warning(`Așteaptă ${remainingSeconds}s înainte să închizi pontajul`);
      triggerHaptic('warning');
      return;
    }

    setLastClickTime(prev => ({ ...prev, [buttonKey]: now }));
    
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

    // PROTECȚIE BATERIE - Blocare pontaj ieșire dacă bateria e critică
    if (batteryInfo.isCriticalBattery && !batteryInfo.charging) {
      toast.error(
        `⚠️ Baterie critică (${Math.round(batteryInfo.level * 100)}%)! Conectează dispozitivul la încărcare pentru a închide pontajul.`,
        {
          description: 'Această măsură previne situații în care nu se poate salva corect pontajul.',
          duration: 8000,
        }
      );
      triggerHaptic('error');
      return;
    }

    // Avertizare baterie scăzută (dar permite continuarea)
    if (batteryInfo.isLowBattery && !batteryInfo.charging) {
      toast.warning(
        `Baterie scăzută (${Math.round(batteryInfo.level * 100)}%). Recomandăm conectarea la încărcare.`,
        { duration: 5000 }
      );
    }

    // ✅ AFIȘEAZĂ DIALOG DE CONFIRMARE PRE-PONTAJ IEȘIRE
    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        maxRetries: 1,
        retryDelay: 1000
      });
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const { data: locations } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true);

      const nearestLocation = locations ? findNearestLocation(currentCoords, locations) : null;

      setPreClockDialog({
        open: true,
        type: "clock-out",
        shiftType: getShiftTypeLabel(activeShift),
        originalShiftType: activeShift,
        location: nearestLocation ? { name: nearestLocation.name, address: nearestLocation.address } : null,
      });
      triggerHaptic('light');
      return;
    } catch (error) {
      console.warn('Could not get location for preview:', error);
    }

    // Dacă nu putem obține locația pentru preview, continuăm direct
    await actuallyEndShift();
  }, [isProcessing, locationEnabled, activeTimeEntry, lastClickTime, activeShift, batteryInfo, triggerHaptic]);

  const actuallyEndShift = useCallback(async () => {
    setIsProcessing(true);
    triggerHaptic('medium');
    
    let loadingToast: string | number | undefined;
    try {
      loadingToast = toast.info('Se obține locația GPS...', { duration: Infinity });
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        maxRetries: 3,
        retryDelay: 1000
      });
      
      if (loadingToast) toast.dismiss(loadingToast);
      
      const currentCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      console.log('[ClockOut] GPS location obtained:', { 
        accuracy: position.coords.accuracy,
        coords: currentCoords 
      });

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
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        triggerHaptic('error');
        return;
      }

      const clockInTime = activeTimeEntry!.clock_in_time;
      const clockOutTime = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_out_time: clockOutTime,
          clock_out_latitude: currentCoords.latitude,
          clock_out_longitude: currentCoords.longitude,
          clock_out_location_id: nearestLocation.id,
        })
        .eq('id', activeTimeEntry!.id);

      if (updateError) throw updateError;

      // Pas 1 + Pas 2: Procesare automată cu retry logic
      console.log('[ClockOut] Starting time segment calculation...');
      const segmentSuccess = await processTimeSegmentsWithRetry(
        user?.id || '',
        activeTimeEntry!.id,
        clockInTime,
        clockOutTime,
        activeTimeEntry!.notes
      );

      if (!segmentSuccess) {
        console.error('[ClockOut] ❌ Failed to calculate segments after retries');
        toast.error('Pontajul a fost salvat, dar procesarea orelor a eșuat. Contactează administratorul.', {
          duration: 10000,
          action: {
            label: 'OK',
            onClick: () => {}
          }
        });
      } else {
        console.log('[ClockOut] ✅ Time segments calculated successfully');
      }

      triggerHaptic('success');
      
      // Show confirmation card with details
      setConfirmationCard({
        show: true,
        type: "clock-out",
        timestamp: clockOutTime,
        locationName: nearestLocation.name,
        locationDistance: nearestLocation.distance,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
      });
      
      toast.success(`Pontaj terminat cu succes`);
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
  }, [activeTimeEntry, triggerHaptic, user]);

  const getShiftTypeLabel = (type: ShiftType) => {
    switch (type) {
      case "condus": return "Condus";
      case "pasager": return "Pasager";
      case "normal": return "Normal";
      case "utilaj": return "Condus Utilaj";
      default: return "";
    }
  };

  // Check if user can see equipment button
  const canSeeEquipmentButton = useMemo(() => {
    const allowedUsernames = ['ababeiciprian', 'costachemarius', 'rusugheorghita'];
    const username = user?.user_metadata?.username;
    return username && allowedUsernames.includes(username.toLowerCase());
  }, [user]);

  const handleTardinessReasonSubmit = useCallback(async (reason: string) => {
    if (!tardinessDialog || !pendingTardinessEntry || !user?.id) return;

    try {
      const { error } = await supabase
        .from('tardiness_reports')
        .insert({
          user_id: user.id,
          time_entry_id: pendingTardinessEntry.id,
          scheduled_start_time: tardinessDialog.scheduledTime,
          actual_clock_in_time: pendingTardinessEntry.clock_in_time,
          delay_minutes: tardinessDialog.delayMinutes,
          reason: reason,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Justificarea a fost trimisă spre aprobare');
      setPendingTardinessEntry(null);
    } catch (error: any) {
      console.error('Error submitting tardiness reason:', error);
      toast.error('Eroare la trimiterea justificării');
    }
  }, [tardinessDialog, pendingTardinessEntry, user]);

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
  const todayTotalMinutes = 392;
  const todayWorkedMinutes = Math.max(0, todayTotalMinutes - BREAK_MINUTES);
  const todayHours = `${Math.floor(todayWorkedMinutes / 60)}h ${todayWorkedMinutes % 60}m`;

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutDialog(false);
    toast.success("La revedere! 👋 Te așteptăm înapoi!", {
      duration: 3000,
    });
    // Small delay to show the toast
    setTimeout(() => {
      signOut();
    }, 500);
  };

  const formattedTime = useMemo(() => formatTime(shiftSeconds), [shiftSeconds]);

  // Versiune fixă + build curent din backend
  const BASE_VERSION = "06.10.2008";
  const { data: currVer } = useQuery({
    queryKey: ["currentAppVersionMobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_versions")
        .select("version")
        .eq("is_current", true)
        .maybeSingle();
      if (error) {
        console.debug("Version fetch error", error);
        return null;
      }
      return data;
    },
  });
  const mobileDisplayVersion = `${BASE_VERSION}.${currVer?.version ?? "10"}`;

  return (
    <AdminLayout title="Pontaj">
      <div className="pb-safe-area-bottom">
        <main className="p-3 xs:p-4 space-y-3 xs:space-y-4 smooth-scroll">
        {/* Header cu numele utilizatorului */}
        <Card className="shadow-custom-md animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bun venit,</p>
                <p className="text-lg font-semibold">{user?.user_metadata?.full_name || user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clock Out Reminder Alert */}
        {activeTimeEntry && showReminderAlert && (
          <ClockOutReminderAlert
            clockInTime={activeTimeEntry.clock_in_time}
            onClockOut={handleShiftEnd}
            onDismiss={() => setShowReminderAlert(false)}
            reminderHours={10}
          />
        )}
        
        {!locationEnabled && locationError && (
          <Card className="border-destructive bg-destructive/10 animate-fade-in">
            <CardContent className="p-3 xs:p-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-responsive-xs font-medium">{locationError}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={requestLocationAccess} 
                  className="touch-target w-full xs:w-auto"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Se verifică..." : "Reîncearcă"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        <Card className="shadow-custom-lg animate-fade-in">
          <CardContent className="p-4 xs:p-6">
            <div className="grid grid-cols-1 gap-2 xs:gap-3">
              <Button
                size="lg"
                onClick={() => handleShiftStart("condus")}
                disabled={!locationEnabled || isProcessing}
                className={`touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95 ${activeShift === "condus" ? "animate-glow-blue border-2 border-blue-400" : ""}`}
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Car className="h-5 w-5 xs:h-6 xs:w-6" />
                    INTRARE CONDUS
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("pasager")}
                disabled={!locationEnabled || isProcessing}
                className={`touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95 ${activeShift === "pasager" ? "animate-glow-green border-2 border-green-400" : ""}`}
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5 xs:h-6 xs:w-6" />
                    INTRARE PASAGER
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={() => handleShiftStart("normal")}
                disabled={!locationEnabled || isProcessing}
                className={`touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95 ${activeShift === "normal" ? "animate-glow-purple border-2 border-purple-400" : ""}`}
              >
                {isProcessing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Briefcase className="h-5 w-5 xs:h-6 xs:w-6" />
                    INTRARE NORMAL
                  </>
                )}
              </Button>

              {canSeeEquipmentButton && (
                <Button
                  size="lg"
                  onClick={() => handleShiftStart("utilaj")}
                  disabled={!locationEnabled || isProcessing}
                  className={`touch-target no-select h-14 xs:h-16 text-responsive-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95 ${activeShift === "utilaj" ? "animate-glow-orange border-2 border-orange-400" : ""}`}
                >
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Se procesează...
                    </>
                  ) : (
                    <>
                      <Car className="h-5 w-5 xs:h-6 xs:w-6" />
                      INTRARE CONDUS UTILAJ
                    </>
                  )}
                </Button>
              )}
              
              {activeShift && (
                <Button
                  size="lg"
                  onClick={handleShiftEnd}
                  disabled={isProcessing}
                  variant="destructive"
                  className="touch-target no-select h-14 xs:h-16 text-responsive-sm flex items-center justify-center gap-2 xs:gap-3 transition-all active:scale-95 mt-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Se procesează...
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 xs:h-6 xs:w-6" />
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
        <Card className="shadow-custom-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-responsive-lg">Calendar Lunar</CardTitle>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && handleCancelShiftChange()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schimbare Regim Tură</AlertDialogTitle>
            <AlertDialogDescription>
              Ai o tură activă de tip <strong>{getShiftTypeLabel(activeShift)}</strong>. 
              Vrei să o închizi și să începi o tură nouă de tip <strong>{getShiftTypeLabel(confirmDialog.newType)}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelShiftChange}>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmShiftChange}>Confirmă Schimbarea</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tardiness Reason Dialog */}
      {tardinessDialog && (
        <TardinessReasonDialog
          open={tardinessDialog.open}
          onClose={() => setTardinessDialog(null)}
          onSubmit={handleTardinessReasonSubmit}
          delayMinutes={tardinessDialog.delayMinutes}
          scheduledTime={tardinessDialog.scheduledTime}
        />
      )}

      {/* Clock In/Out Confirmation Card */}
      {confirmationCard?.show && (
        <ClockInConfirmationCard
          type={confirmationCard.type}
          timestamp={confirmationCard.timestamp}
          locationName={confirmationCard.locationName}
          locationDistance={confirmationCard.locationDistance}
          latitude={confirmationCard.latitude}
          longitude={confirmationCard.longitude}
          shiftType={confirmationCard.shiftType}
          onClose={() => setConfirmationCard(null)}
        />
      )}

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        onConfirm={handleLogoutConfirm}
      />

      {/* Pre-Clock Confirmation Dialog */}
      {preClockDialog && (
        <ClockConfirmationDialog
          open={preClockDialog.open}
          onOpenChange={(open) => !open && setPreClockDialog(null)}
          onConfirm={async () => {
            const type = preClockDialog.type;
            const originalShift = preClockDialog.originalShiftType;
            setPreClockDialog(null);
            if (type === "clock-in") {
              await actuallyStartShift(originalShift || "normal");
            } else {
              await actuallyEndShift();
            }
          }}
          type={preClockDialog.type}
          shiftType={preClockDialog.shiftType}
          location={preClockDialog.location}
          loading={isProcessing}
        />
      )}
      </div>
    </AdminLayout>
  );
};

export default Mobile;
