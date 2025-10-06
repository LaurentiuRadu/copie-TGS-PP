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
    <div className="flex flex-col items-center justify-center min-w-0 gap-0.5">
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="h-5 w-5 text-primary flex-shrink-0" />
        <span className="text-xl font-bold tabular-nums">
          {format(romaniaTime, 'HH:mm:ss')}
        </span>
      </div>
      <span className="text-sm text-muted-foreground font-medium">
        {format(romaniaTime, 'dd MMM yyyy', { locale: ro })}
      </span>
    </div>
  );
};
