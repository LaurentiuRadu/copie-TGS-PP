import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPosition, findNearestLocation } from '@/lib/geolocation';
import { generateDeviceFingerprint, getDeviceInfo, getClientIP } from '@/lib/deviceFingerprint';
import { toast } from 'sonner';

type ShiftType = "condus" | "pasager" | "normal" | null;

export const useMobileShift = (user: any, triggerHaptic: any) => {
  const [activeShift, setActiveShift] = useState<ShiftType>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [activeTimeEntry, setActiveTimeEntry] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check for active shift on mount
  useEffect(() => {
    const checkActiveShift = async () => {
      if (!user?.id) return;

      try {
        const { data: activeEntry, error } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.id)
          .is('clock_out_time', null)
          .order('clock_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return;

        if (activeEntry) {
          const notesMatch = activeEntry.notes?.match(/Tip: (Condus|Pasager|Normal)/i);
          const shiftType = notesMatch ? (notesMatch[1].toLowerCase() as ShiftType) : 'normal';

          const clockInTime = new Date(activeEntry.clock_in_time).getTime();
          const elapsedSeconds = Math.floor((Date.now() - clockInTime) / 1000);

          setActiveTimeEntry(activeEntry);
          setActiveShift(shiftType);
          setShiftSeconds(elapsedSeconds);
        }
      } catch (error) {
        // Silent fail
      }
    };

    checkActiveShift();
  }, [user?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeShift) {
      interval = setInterval(() => {
        setShiftSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeShift]);

  const handleShiftStart = useCallback(async (
    type: ShiftType, 
    locationEnabled: boolean,
    skipConfirmation: boolean = false
  ) => {
    if (isProcessing || !locationEnabled) return false;

    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      // Close any existing active shifts
      const { data: existingEntries } = await supabase
        .from('time_entries')
        .select('id, clock_in_time')
        .eq('user_id', user?.id)
        .is('clock_out_time', null);

      if (existingEntries && existingEntries.length > 0) {
        for (const entry of existingEntries) {
          const clockOutTime = new Date().toISOString();
          await supabase
            .from('time_entries')
            .update({ clock_out_time: clockOutTime })
            .eq('id', entry.id);

          try {
            await supabase.functions.invoke('calculate-time-segments', {
              body: {
                time_entry_id: entry.id,
                clock_in_time: entry.clock_in_time,
                clock_out_time: clockOutTime
              }
            });
          } catch (e) {
            // Silent fail on segment calculation
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
        return false;
      }

      const nearestLocation = findNearestLocation(currentCoords, locations);
      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        return false;
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
          notes: `Tip: ${type === 'condus' ? 'Condus' : type === 'pasager' ? 'Pasager' : 'Normal'}`
        }])
        .select()
        .single();

      if (entryError) throw entryError;

      setActiveTimeEntry(entry);
      setActiveShift(type);
      setShiftSeconds(0);
      triggerHaptic('success');

      toast.success(`Pontaj început la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      return true;

    } catch (error: any) {
      triggerHaptic('error');
      toast.error(error.message || "Eroare la începerea pontajului");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user, isProcessing, triggerHaptic]);

  const handleShiftEnd = useCallback(async (locationEnabled: boolean) => {
    if (isProcessing || !activeTimeEntry || !locationEnabled) return false;

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
        return false;
      }

      const nearestLocation = findNearestLocation(currentCoords, locations);
      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        return false;
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
      } catch (e) {
        // Silent fail on segment calculation
      }

      triggerHaptic('success');
      toast.success(`Pontaj terminat la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      
      setActiveShift(null);
      setShiftSeconds(0);
      setActiveTimeEntry(null);
      
      return true;

    } catch (error: any) {
      triggerHaptic('error');
      toast.error(error.message || "Eroare la terminarea pontajului");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [activeTimeEntry, isProcessing, triggerHaptic]);

  return {
    activeShift,
    shiftSeconds,
    activeTimeEntry,
    isProcessing,
    handleShiftStart,
    handleShiftEnd,
    setActiveTimeEntry,
  };
};
