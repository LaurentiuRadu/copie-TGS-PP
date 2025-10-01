import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ro } from 'date-fns/locale';
import { Clock } from 'lucide-react';

export const RomaniaTimeClock = () => {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Convertește ora curentă la timezone-ul României
  const romaniaTime = toZonedTime(time, 'Europe/Bucharest');
  
  return (
    <div className="flex items-center gap-2 text-foreground bg-card/50 rounded-lg px-3 py-1.5 border border-border">
      <Clock className="h-4 w-4 text-primary" />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tabular-nums">
          {format(romaniaTime, 'HH:mm:ss')}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(romaniaTime, 'dd MMM yyyy', { locale: ro })}
        </span>
      </div>
    </div>
  );
};
