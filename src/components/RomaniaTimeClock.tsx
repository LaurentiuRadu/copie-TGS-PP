import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ro } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RomaniaTimeClockProps {
  variant?: 'compact' | 'large';
}

export const RomaniaTimeClock = ({ variant = 'compact' }: RomaniaTimeClockProps) => {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Convertește ora curentă la timezone-ul României
  const romaniaTime = toZonedTime(time, 'Europe/Bucharest');
  
  if (variant === 'large') {
    return (
      <div className="flex items-center gap-4 text-foreground">
        <Clock className="h-10 w-10 text-primary flex-shrink-0 animate-float" />
        <div className="flex flex-col leading-tight">
          <span className="text-5xl font-bold tabular-nums tracking-tight">
            {format(romaniaTime, 'HH:mm:ss')}
          </span>
          <span className="text-xl text-muted-foreground mt-1">
            {format(romaniaTime, 'EEEE, dd MMMM yyyy', { locale: ro })}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1.5 text-foreground bg-card/50 rounded-lg px-2 py-1 border border-border">
      <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="text-xs font-semibold tabular-nums">
          {format(romaniaTime, 'HH:mm:ss')}
        </span>
        <span className="text-[10px] text-muted-foreground hidden sm:block">
          {format(romaniaTime, 'dd MMM', { locale: ro })}
        </span>
      </div>
    </div>
  );
};
