import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, Timer, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPosition, findNearestLocation } from '@/lib/geolocation';
import { toast } from 'sonner';

interface ActiveShiftAlertProps {
  clockInTime: string;
  shiftType: string;
  className?: string;
  timeEntryId: string;
  onClockOut?: () => void;
}

export function ActiveShiftAlert({ clockInTime, shiftType, className, timeEntryId, onClockOut }: ActiveShiftAlertProps) {
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isLongShift, setIsLongShift] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(clockInTime);
      const now = new Date();
      const diff = now.getTime() - start.getTime();
      
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setElapsed({ hours, minutes, seconds });
      setIsLongShift(hours >= 12);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [clockInTime]);

  const formatTime = `${elapsed.hours.toString().padStart(2, '0')}:${elapsed.minutes.toString().padStart(2, '0')}:${elapsed.seconds.toString().padStart(2, '0')}`;

  const handleQuickClockOut = async () => {
    setIsProcessing(true);
    
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
        return;
      }

      const nearestLocation = findNearestLocation(currentCoords, locations);

      if (!nearestLocation) {
        toast.error("Nu te afli în apropierea niciunei locații de lucru permise");
        return;
      }

      const clockOutTime = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_out_time: clockOutTime,
          clock_out_latitude: currentCoords.latitude,
          clock_out_longitude: currentCoords.longitude,
          clock_out_location_id: nearestLocation.id,
        })
        .eq('id', timeEntryId);

      if (updateError) throw updateError;

      try {
        await supabase.functions.invoke('calculate-time-segments', {
          body: {
            time_entry_id: timeEntryId,
            clock_in_time: clockInTime,
            clock_out_time: clockOutTime
          }
        });
      } catch (segmentError) {
        console.error('Failed to calculate segments:', segmentError);
      }

      toast.success(`Pontaj terminat la ${nearestLocation.name} (${Math.round(nearestLocation.distance)}m)`);
      setShowConfirmDialog(false);
      onClockOut?.();
      
    } catch (error: any) {
      console.error('Failed to end shift:', error);
      toast.error(error.message || "Eroare la terminarea pontajului");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Alert 
        className={cn(
          "border-2 animate-pulse-slow",
          isLongShift 
            ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" 
            : "border-primary bg-primary/5",
          className
        )}
      >
        <div className="flex flex-col sm:flex-row items-start gap-3">
          <div className={cn(
            "p-2 rounded-full",
            isLongShift 
              ? "bg-orange-100 dark:bg-orange-900/30" 
              : "bg-primary/10"
          )}>
            {isLongShift ? (
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            ) : (
              <Timer className="h-5 w-5 text-primary animate-spin-slow" />
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isLongShift ? '⚠️ Pontaj activ de mult timp!' : 'Pontaj Activ'}
                </span>
              </div>
              <Badge variant={isLongShift ? "destructive" : "default"} className="font-mono text-sm">
                {formatTime}
              </Badge>
            </div>
            
            <AlertDescription className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tip tură:</span>
                <Badge variant="outline" className="text-xs">
                  {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)}
                </Badge>
              </div>
              <div className="text-muted-foreground">
                Început: {new Date(clockInTime).toLocaleString('ro-RO', { 
                  day: '2-digit',
                  month: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
              {isLongShift && (
                <div className="mt-2 text-orange-600 dark:text-orange-400 font-medium">
                  💡 Nu uita să închizi pontajul când termini tura!
                </div>
              )}
            </AlertDescription>
          </div>
          
          <div className="w-full sm:w-auto">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={isProcessing}
              variant="outline"
              size="sm"
              className={cn(
                "w-full sm:w-auto touch-target transition-all",
                isLongShift 
                  ? "border-orange-500 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300" 
                  : "border-primary bg-primary/5 hover:bg-primary/10"
              )}
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Se procesează...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Ieșire Rapidă
                </>
              )}
            </Button>
          </div>
        </div>
      </Alert>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmare Ieșire</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să închizi pontajul activ? 
              <br />
              <strong>Timp lucrat: {formatTime}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Anulează</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleQuickClockOut}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? "Se procesează..." : "Confirmă Ieșirea"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
