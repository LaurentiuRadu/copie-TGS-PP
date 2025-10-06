import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveShiftAlertProps {
  clockInTime: string;
  shiftType: string;
  className?: string;
}

export function ActiveShiftAlert({ clockInTime, shiftType, className }: ActiveShiftAlertProps) {
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isLongShift, setIsLongShift] = useState(false);

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

  return (
    <Alert 
      className={cn(
        "border-2 animate-pulse-slow",
        isLongShift 
          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" 
          : "border-primary bg-primary/5",
        className
      )}
    >
      <div className="flex items-start gap-3">
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
      </div>
    </Alert>
  );
}
