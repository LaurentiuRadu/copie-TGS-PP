import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Clock, MapPin, Calendar as CalendarIcon, AlertCircle, Image as ImageIcon, Car, Users, Briefcase, Wrench, Navigation, Battery } from 'lucide-react';
import { toast } from 'sonner';
import { TimeEntryCorrectionDialog } from '@/components/TimeEntryCorrectionDialog';
import { ClockInConfirmationCard } from '@/components/ClockInConfirmationCard';
import { ClockConfirmationDialog } from '@/components/ClockConfirmationDialog';
import { TardinessReasonDialog } from '@/components/TardinessReasonDialog';
import { RomaniaTimeClock } from '@/components/RomaniaTimeClock';
import { useActiveTimeEntry } from '@/hooks/useActiveTimeEntry';
import { useTardinessCheck } from '@/hooks/useTardinessCheck';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSafeArea } from '@/hooks/useSafeArea';
import { getCurrentPosition, findNearestLocation } from '@/lib/geolocation';
import { useOptimizedMyTimeEntries } from '@/hooks/useOptimizedTimeEntries';
import { useMyDailyTimesheets } from '@/hooks/useDailyTimesheets';
import { cn } from '@/lib/utils';

type ShiftType = 'condus' | 'pasager' | 'normal' | 'utilaj' | null;

interface PreClockDialogState {
  open: boolean;
  type: 'clock-in' | 'clock-out';
  shiftType?: ShiftType;
  location?: { name: string; distance: number };
  latitude?: number;
  longitude?: number;
}

interface ConfirmationCardState {
  visible: boolean;
  type: 'clock-in' | 'clock-out';
  timestamp: string;
  locationName?: string;
  locationDistance?: number;
  latitude?: number;
  longitude?: number;
  shiftType?: ShiftType;
}

interface TardinessDialogState {
  open: boolean;
  delayMinutes: number;
  scheduledTime: string;
  actualTime: string;
  timeEntryId: string;
}

const getShiftTypeFromNotes = (notes: string | null): string => {
  if (!notes) return 'Normal';
  const lower = notes.toLowerCase();
  if (lower.includes('condus utilaj')) return 'Condus Utilaj';
  if (lower.includes('condus')) return 'Condus';
  if (lower.includes('pasager')) return 'Pasager';
  return 'Normal';
};

const getShiftColor = (shiftType: string): string => {
  switch (shiftType.toLowerCase()) {
    case 'condus':
      return 'bg-green-500';
    case 'pasager':
      return 'bg-blue-500';
    case 'utilaj':
    case 'condus utilaj':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
};

export default function MyTimeEntries() {
  const { user } = useAuth();
  const { triggerHaptic } = useHapticFeedback();
  const safeArea = useSafeArea();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [activeShift, setActiveShift] = useState<ShiftType>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preClockDialog, setPreClockDialog] = useState<PreClockDialogState>({
    open: false,
    type: 'clock-in',
  });
  const [confirmationCard, setConfirmationCard] = useState<ConfirmationCardState>({
    visible: false,
    type: 'clock-in',
    timestamp: '',
  });
  const [tardinessDialog, setTardinessDialog] = useState<TardinessDialogState>({
    open: false,
    delayMinutes: 0,
    scheduledTime: '',
    actualTime: '',
    timeEntryId: '',
  });

  const startDate = startOfMonth(new Date(selectedMonth + '-01'));
  const endDate = endOfMonth(startDate);

  const { data: timeEntries = [], isLoading: entriesLoading } = useOptimizedMyTimeEntries(user?.id, startDate);
  const { data: dailyTimesheets = [], isLoading: timesheetsLoading } = useMyDailyTimesheets(user?.id, startDate);
  const { activeEntry, elapsed, hasActiveEntry, refetch: refetchActiveEntry } = useActiveTimeEntry(user?.id);
  const { isLate, delayMinutes, scheduledTime } = useTardinessCheck(user?.id, hasActiveEntry);

  // Filtrare time entries pentru luna selectată
  const filteredTimeEntries = timeEntries.filter((entry: any) => {
    const entryDate = new Date(entry.clock_in_time);
    return entryDate >= startDate && entryDate <= endDate;
  });

  // Grupare pe zile
  const entriesByDay = filteredTimeEntries.reduce((acc: any, entry: any) => {
    const dayKey = format(new Date(entry.clock_in_time), 'yyyy-MM-dd');
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(entry);
    return acc;
  }, {});

  // Calculare statistici lunare
  const monthlyStats = dailyTimesheets
    .filter((ts: any) => {
      const tsDate = new Date(ts.work_date);
      return tsDate >= startDate && tsDate <= endDate;
    })
    .reduce((acc: any, ts: any) => ({
      total: acc.total + (ts.hours_regular || 0) + (ts.hours_night || 0),
      regular: acc.regular + (ts.hours_regular || 0),
      night: acc.night + (ts.hours_night || 0),
      weekend: acc.weekend + (ts.hours_saturday || 0) + (ts.hours_sunday || 0),
      holiday: acc.holiday + (ts.hours_holiday || 0),
      driving: acc.driving + (ts.hours_driving || 0),
      passenger: acc.passenger + (ts.hours_passenger || 0),
      equipment: acc.equipment + (ts.hours_equipment || 0),
    }), {
      total: 0,
      regular: 0,
      night: 0,
      weekend: 0,
      holiday: 0,
      driving: 0,
      passenger: 0,
      equipment: 0,
    });

  // Fetch correction requests
  const { data: correctionRequests = [] } = useQuery({
    queryKey: ['my-correction-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('time_entry_correction_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Request location access on mount
  useEffect(() => {
    const requestLocation = async () => {
      try {
        const position = await getCurrentPosition();
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationEnabled(true);
      } catch (error) {
        console.error('Failed to get location:', error);
        setLocationEnabled(false);
        toast.error('Nu s-a putut accesa locația GPS');
      }
    };
    requestLocation();
  }, []);

  // Check for active entry on mount
  useEffect(() => {
    if (activeEntry?.notes) {
      const shiftType = getShiftTypeFromNotes(activeEntry.notes);
      if (shiftType === 'Condus') setActiveShift('condus');
      else if (shiftType === 'Pasager') setActiveShift('pasager');
      else if (shiftType === 'Condus Utilaj') setActiveShift('utilaj');
      else setActiveShift('normal');
    } else {
      setActiveShift(null);
    }
  }, [activeEntry]);

  const formatTime = (hours: number, minutes: number) => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Helper function to get nearest location with proper error handling
  const getNearestLocation = async (latitude: number, longitude: number) => {
    const { data: locations, error } = await supabase
      .from('work_locations')
      .select('id, name, latitude, longitude, radius_meters, coverage_type, geometry')
      .eq('is_active', true);

    if (error) {
      console.error('[getNearestLocation] Error fetching locations:', error);
      throw new Error('Nu s-au putut încărca locațiile de lucru');
    }

    if (!locations || locations.length === 0) {
      throw new Error('Nu există locații de lucru configurate');
    }

    const nearest = findNearestLocation({ latitude, longitude }, locations);
    
    if (!nearest) {
      throw new Error('Nu ești în apropierea unei locații valide de lucru');
    }

    return nearest;
  };

  const handleShiftStart = async (shiftType: ShiftType) => {
    if (!user?.id || isProcessing) return;
    
    triggerHaptic('medium');
    
    if (!locationEnabled || !currentLocation) {
      toast.error('Locația GPS nu este disponibilă. Reîncearcă.');
      return;
    }

    setIsProcessing(true);

    try {
      // Get current position
      const position = await getCurrentPosition();
      const nearestLocation = await getNearestLocation(
        position.coords.latitude,
        position.coords.longitude
      );

      // Show pre-clock dialog
      setPreClockDialog({
        open: true,
        type: 'clock-in',
        shiftType,
        location: {
          name: nearestLocation.name,
          distance: nearestLocation.distance,
        },
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error: any) {
      console.error('Error starting shift:', error);
      toast.error(error.message || 'Eroare la pornirea pontajului');
    } finally {
      setIsProcessing(false);
    }
  };

  const actuallyStartShift = async () => {
    if (!user?.id || !preClockDialog.shiftType || !preClockDialog.latitude || !preClockDialog.longitude) {
      return;
    }

    setIsProcessing(true);

    try {
      const nearestLocation = await getNearestLocation(
        preClockDialog.latitude,
        preClockDialog.longitude
      );

      const shiftNotes = preClockDialog.shiftType === 'condus' ? 'Condus' :
                        preClockDialog.shiftType === 'pasager' ? 'Pasager' :
                        preClockDialog.shiftType === 'utilaj' ? 'Condus Utilaj' :
                        'Normal';

      const { data: newEntry, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          clock_in_time: new Date().toISOString(),
          clock_in_latitude: preClockDialog.latitude,
          clock_in_longitude: preClockDialog.longitude,
          clock_in_location_id: nearestLocation?.id,
          notes: shiftNotes,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveShift(preClockDialog.shiftType);
      setPreClockDialog({ open: false, type: 'clock-in' });
      
      triggerHaptic('success');
      
      // Show confirmation card
      setConfirmationCard({
        visible: true,
        type: 'clock-in',
        timestamp: new Date().toISOString(),
        locationName: nearestLocation?.name,
        locationDistance: nearestLocation?.distance,
        latitude: preClockDialog.latitude,
        longitude: preClockDialog.longitude,
        shiftType: preClockDialog.shiftType,
      });

      refetchActiveEntry();

      // Check tardiness
      if (isLate && delayMinutes > 0 && scheduledTime) {
        setTardinessDialog({
          open: true,
          delayMinutes,
          scheduledTime,
          actualTime: new Date().toISOString(),
          timeEntryId: newEntry.id,
        });
      }
    } catch (error: any) {
      console.error('Error creating time entry:', error);
      toast.error('Eroare la înregistrarea pontajului');
      triggerHaptic('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShiftEnd = async () => {
    if (!user?.id || !activeEntry || isProcessing) return;
    
    triggerHaptic('medium');
    
    if (!locationEnabled || !currentLocation) {
      toast.error('Locația GPS nu este disponibilă. Reîncearcă.');
      return;
    }

    setIsProcessing(true);

    try {
      const position = await getCurrentPosition();
      const nearestLocation = await getNearestLocation(
        position.coords.latitude,
        position.coords.longitude
      );

      // Show pre-clock-out dialog
      setPreClockDialog({
        open: true,
        type: 'clock-out',
        location: {
          name: nearestLocation.name,
          distance: nearestLocation.distance,
        },
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error: any) {
      console.error('Error ending shift:', error);
      toast.error(error.message || 'Eroare la închiderea pontajului');
    } finally {
      setIsProcessing(false);
    }
  };

  const actuallyEndShift = async () => {
    if (!user?.id || !activeEntry || !preClockDialog.latitude || !preClockDialog.longitude) {
      return;
    }

    setIsProcessing(true);

    try {
      const nearestLocation = await getNearestLocation(
        preClockDialog.latitude,
        preClockDialog.longitude
      );

      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_out_time: new Date().toISOString(),
          clock_out_latitude: preClockDialog.latitude,
          clock_out_longitude: preClockDialog.longitude,
          clock_out_location_id: nearestLocation?.id,
          needs_reprocessing: true,
        })
        .eq('id', activeEntry.id);

      if (error) throw error;

      setActiveShift(null);
      setPreClockDialog({ open: false, type: 'clock-in' });
      
      triggerHaptic('success');
      
      // Show confirmation card
      setConfirmationCard({
        visible: true,
        type: 'clock-out',
        timestamp: new Date().toISOString(),
        locationName: nearestLocation?.name,
        locationDistance: nearestLocation?.distance,
        latitude: preClockDialog.latitude,
        longitude: preClockDialog.longitude,
      });

      refetchActiveEntry();
      
      // Process time segments
      await processTimeSegmentsWithRetry(activeEntry.id);
    } catch (error: any) {
      console.error('Error ending shift:', error);
      toast.error('Eroare la închiderea pontajului');
      triggerHaptic('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const processTimeSegmentsWithRetry = async (entryId: string, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { error } = await supabase.functions.invoke('calculate-time-segments', {
          body: { timeEntryId: entryId },
        });

        if (!error) {
          console.log(`[processTimeSegments] Succes la încercarea ${i + 1}`);
          return;
        }

        console.warn(`[processTimeSegments] Eroare la încercarea ${i + 1}:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
      } catch (error) {
        console.error(`[processTimeSegments] Exception la încercarea ${i + 1}:`, error);
        if (i === retries - 1) {
          toast.warning('Pontajul a fost înregistrat, dar procesarea detaliilor va fi făcută automat mai târziu.');
        }
      }
    }
  };

  const handleTardinessSubmit = async (reason: string) => {
    if (!user?.id || !tardinessDialog.timeEntryId) return;

    try {
      const { error } = await supabase.from('tardiness_reports').insert({
        user_id: user.id,
        time_entry_id: tardinessDialog.timeEntryId,
        scheduled_start_time: tardinessDialog.scheduledTime,
        actual_clock_in_time: tardinessDialog.actualTime,
        delay_minutes: tardinessDialog.delayMinutes,
        reason: reason,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Justificarea a fost trimisă cu succes');
      setTardinessDialog({ open: false, delayMinutes: 0, scheduledTime: '', actualTime: '', timeEntryId: '' });
    } catch (error) {
      console.error('Error submitting tardiness reason:', error);
      toast.error('Eroare la trimiterea justificării');
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, 'MMMM yyyy', { locale: ro });
      options.push({ value, label });
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  // Generate calendar days for the selected month
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Group entries by date for calendar coloring
  const entriesByDate = filteredTimeEntries.reduce((acc: any, entry: any) => {
    const dateKey = format(new Date(entry.clock_in_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {});

  const isLoading = entriesLoading || timesheetsLoading;

  return (
    <AdminLayout title="Pontaj Personal">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pontaj Personal</h1>
            <p className="text-muted-foreground mt-1">Gestionează-ți pontajele și rapoartele</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorrectionDialogOpen(true)}
              className="relative"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Raportează Problemă
              {correctionRequests.filter((req: any) => req.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {correctionRequests.filter((req: any) => req.status === 'pending').length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Clock In/Out Control Panel */}
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Control Pontaj
              </CardTitle>
              <RomaniaTimeClock />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GPS Status */}
            <div className="flex items-center gap-2 text-sm">
              <Navigation className={cn("h-4 w-4", locationEnabled ? "text-green-500" : "text-red-500")} />
              <span className={locationEnabled ? "text-green-500" : "text-red-500"}>
                {locationEnabled ? '✅ Locație GPS Activă' : '❌ Locație GPS Indisponibilă'}
              </span>
            </div>

            {!hasActiveEntry ? (
              /* Clock In Buttons */
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleShiftStart('condus')}
                  disabled={isProcessing || !locationEnabled}
                  className="h-16 bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  <Car className="mr-2 h-5 w-5" />
                  Intrare Condus
                </Button>
                <Button
                  onClick={() => handleShiftStart('pasager')}
                  disabled={isProcessing || !locationEnabled}
                  className="h-16 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  <Users className="mr-2 h-5 w-5" />
                  Intrare Pasager
                </Button>
                <Button
                  onClick={() => handleShiftStart('normal')}
                  disabled={isProcessing || !locationEnabled}
                  className="h-16 bg-gray-600 hover:bg-gray-700 text-white font-semibold"
                >
                  <Briefcase className="mr-2 h-5 w-5" />
                  Intrare Normal
                </Button>
                <Button
                  onClick={() => handleShiftStart('utilaj')}
                  disabled={isProcessing || !locationEnabled}
                  className="h-16 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  <Wrench className="mr-2 h-5 w-5" />
                  Intrare Utilaj
                </Button>
              </div>
            ) : (
              /* Active Shift Display */
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Tură Activă</span>
                    <Badge variant="default" className={cn("font-semibold", getShiftColor(getShiftTypeFromNotes(activeEntry.notes)))}>
                      {getShiftTypeFromNotes(activeEntry.notes)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-2xl font-bold text-foreground">
                    <Clock className="h-6 w-6 text-primary animate-pulse" />
                    {formatTime(elapsed.hours, elapsed.minutes)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Început la: {format(new Date(activeEntry.clock_in_time), 'HH:mm', { locale: ro })}
                  </div>
                </div>

                <Button
                  onClick={handleShiftEnd}
                  disabled={isProcessing || !locationEnabled}
                  variant="destructive"
                  className="w-full h-14 font-semibold text-lg"
                >
                  <Clock className="mr-2 h-5 w-5" />
                  Închide Pontaj
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Calendar Lunar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                <div key={i} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startDate.getDay() === 0 ? 6 : startDate.getDay() - 1 }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square p-1" />
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEntries = entriesByDate[dateKey] || [];
                const shiftType = dayEntries[0] ? getShiftTypeFromNotes(dayEntries[0].notes) : null;
                const totalHours = dayEntries.reduce((sum: number, entry: any) => {
                  if (entry.clock_out_time) {
                    const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
                    return sum + duration;
                  }
                  return sum;
                }, 0);

                return (
                  <button
                    key={dateKey}
                    onClick={() => {
                      const element = document.getElementById(`day-${dateKey}`);
                      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={cn(
                      "aspect-square p-1 rounded-lg border-2 transition-all hover:scale-105",
                      dayEntries.length > 0 ? "border-primary/50" : "border-transparent",
                      isSameDay(day, new Date()) && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className={cn(
                        "text-sm font-medium",
                        isSameDay(day, new Date()) ? "text-primary font-bold" : "text-foreground"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {shiftType && (
                        <div className={cn("w-2 h-2 rounded-full mt-1", getShiftColor(shiftType))} />
                      )}
                      {totalHours > 0 && (
                        <span className="text-xs text-muted-foreground">{totalHours.toFixed(1)}h</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Condus</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Pasager</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Utilaj</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Correction Requests */}
        {correctionRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cereri Recente de Corecție</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {correctionRequests.slice(0, 3).map((request: any) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{request.request_type === 'missing_entry' ? 'Lipsă pontaj' : 'Corecție pontaj'}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(request.work_date), 'dd MMM yyyy', { locale: ro })}</p>
                  </div>
                  <Badge variant={
                    request.status === 'pending' ? 'default' :
                    request.status === 'approved' ? 'default' :
                    'destructive'
                  }>
                    {request.status === 'pending' ? 'În așteptare' :
                     request.status === 'approved' ? 'Aprobată' :
                     'Respinsă'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Monthly Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Ore</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyStats.total.toFixed(1)}h</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ore Regulate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyStats.regular.toFixed(1)}h</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ore Noapte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{monthlyStats.night.toFixed(1)}h</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ore Weekend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{monthlyStats.weekend.toFixed(1)}h</div>
            </CardContent>
          </Card>

          {monthlyStats.driving > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ore Condus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{monthlyStats.driving.toFixed(1)}h</div>
              </CardContent>
            </Card>
          )}

          {monthlyStats.passenger > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ore Pasager</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{monthlyStats.passenger.toFixed(1)}h</div>
              </CardContent>
            </Card>
          )}

          {monthlyStats.equipment > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ore Utilaj</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{monthlyStats.equipment.toFixed(1)}h</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Time Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>Pontaje Detaliate</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : Object.keys(entriesByDay).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nu există pontaje înregistrate în această lună
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {Object.entries(entriesByDay)
                  .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                  .map(([date, entries]: [string, any]) => {
                    const totalMinutes = entries.reduce((sum: number, entry: any) => {
                      if (entry.clock_out_time) {
                        return sum + ((new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / 60000);
                      }
                      return sum;
                    }, 0);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = Math.floor(totalMinutes % 60);

                    return (
                      <AccordionItem key={date} value={date} id={`day-${date}`} className="border rounded-lg">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <CalendarIcon className="h-5 w-5 text-primary" />
                              <div className="text-left">
                                <div className="font-semibold">
                                  {format(new Date(date), 'EEEE, d MMMM yyyy', { locale: ro })}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {entries.length} {entries.length === 1 ? 'pontaj' : 'pontaje'}
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="ml-auto">
                              {hours}h {minutes}m
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-3 pt-2">
                            {entries.map((entry: any) => {
                              const duration = entry.clock_out_time
                                ? (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / 60000
                                : 0;
                              const durationHours = Math.floor(duration / 60);
                              const durationMinutes = Math.floor(duration % 60);

                              return (
                                <div key={entry.id} className="p-4 bg-muted rounded-lg space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-primary" />
                                      <span className="font-medium">
                                        {format(new Date(entry.clock_in_time), 'HH:mm')}
                                        {entry.clock_out_time && ` - ${format(new Date(entry.clock_out_time), 'HH:mm')}`}
                                      </span>
                                    </div>
                                    {entry.notes && (
                                      <Badge variant="outline" className={cn("font-medium", getShiftColor(getShiftTypeFromNotes(entry.notes)))}>
                                        {getShiftTypeFromNotes(entry.notes)}
                                      </Badge>
                                    )}
                                  </div>

                                  {entry.clock_out_time && (
                                    <div className="text-sm text-muted-foreground">
                                      Durată: {durationHours}h {durationMinutes}m
                                    </div>
                                  )}

                                  {(entry.clock_in_location_id || entry.clock_out_location_id) && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <MapPin className="h-4 w-4" />
                                      <span>Locație validată GPS</span>
                                    </div>
                                  )}

                                  {(entry.clock_in_photo_url || entry.clock_out_photo_url) && (
                                    <div className="flex gap-2">
                                      {entry.clock_in_photo_url && (
                                        <div className="relative group cursor-pointer">
                                          <img
                                            src={entry.clock_in_photo_url}
                                            alt="Poză intrare"
                                            className="w-20 h-20 object-cover rounded-lg border-2 border-primary/50"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                            <ImageIcon className="h-6 w-6 text-white" />
                                          </div>
                                        </div>
                                      )}
                                      {entry.clock_out_photo_url && (
                                        <div className="relative group cursor-pointer">
                                          <img
                                            src={entry.clock_out_photo_url}
                                            alt="Poză ieșire"
                                            className="w-20 h-20 object-cover rounded-lg border-2 border-destructive/50"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                            <ImageIcon className="h-6 w-6 text-white" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
              </Accordion>
            )}
          </CardContent>
        </Card>

      {/* Dialogs */}
      <TimeEntryCorrectionDialog
        open={correctionDialogOpen}
        onOpenChange={setCorrectionDialogOpen}
      />

      <ClockConfirmationDialog
        open={preClockDialog.open}
        onOpenChange={(open) => setPreClockDialog({ ...preClockDialog, open })}
        onConfirm={preClockDialog.type === 'clock-in' ? actuallyStartShift : actuallyEndShift}
        type={preClockDialog.type}
        shiftType={preClockDialog.shiftType}
        location={preClockDialog.location ? { name: preClockDialog.location.name } : undefined}
        loading={isProcessing}
      />

      <TardinessReasonDialog
        open={tardinessDialog.open}
        onClose={() => setTardinessDialog({ ...tardinessDialog, open: false })}
        onSubmit={handleTardinessSubmit}
        delayMinutes={tardinessDialog.delayMinutes}
        scheduledTime={tardinessDialog.scheduledTime}
      />

      {confirmationCard.visible && (
        <ClockInConfirmationCard
          type={confirmationCard.type}
          timestamp={confirmationCard.timestamp}
          locationName={confirmationCard.locationName}
          locationDistance={confirmationCard.locationDistance}
          latitude={confirmationCard.latitude}
          longitude={confirmationCard.longitude}
          shiftType={confirmationCard.shiftType}
          onClose={() => setConfirmationCard({ ...confirmationCard, visible: false })}
        />
      )}
      </div>
    </AdminLayout>
  );
}
