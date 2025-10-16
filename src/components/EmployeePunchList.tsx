import { formatRomania } from '@/lib/timezone';
import { cn } from '@/lib/utils';

interface PunchEvent {
  time: string;
  type: 'clock_in' | 'clock_out';
  label: string;
  entry: any;
}

interface EmployeePunchListProps {
  entries: any[];
}

export const EmployeePunchList = ({ entries }: EmployeePunchListProps) => {
  // Construim lista de evenimente din toate entry-urile
  const events: PunchEvent[] = [];
  
  entries.forEach(entry => {
    // Determinăm tipul bazat pe segmente
    const segments = entry.time_entry_segments || entry.segments || [];
    const segmentTypes = segments.map((s: any) => s.segment_type || s.type);
    
    let typeLabel = '';
    
    if (segmentTypes.includes('hours_passenger')) {
      typeLabel = 'Pasager';
    } else if (segmentTypes.includes('hours_driving')) {
      typeLabel = 'Șofer';
    } else if (segmentTypes.includes('hours_equipment')) {
      typeLabel = 'Utilaj';
    }
    
    // Clock In
    events.push({
      time: entry.clock_in_time,
      type: 'clock_in',
      label: typeLabel ? `Intrare ${typeLabel}` : 'Intrare',
      entry,
    });
    
    // Clock Out (dacă există)
    if (entry.clock_out_time) {
      events.push({
        time: entry.clock_out_time,
        type: 'clock_out',
        label: typeLabel ? `Ieșire ${typeLabel}` : 'Ieșire',
        entry,
      });
    }
  });
  
  // Sortăm cronologic
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-2">
        Nu există pontaje înregistrate
      </div>
    );
  }
  
  return (
    <div className="space-y-1 py-2">
      {events.map((event, idx) => (
        <div key={idx} className="flex items-center gap-3 text-sm">
          <span className={cn(
            "w-36 font-medium",
            event.type === 'clock_in' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {event.label}
          </span>
          <span className="text-muted-foreground">-</span>
          <span className="font-mono text-foreground">
            {formatRomania(event.time, 'HH:mm')}
          </span>
        </div>
      ))}
    </div>
  );
};
