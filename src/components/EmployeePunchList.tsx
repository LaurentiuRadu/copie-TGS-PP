import { formatRomania } from '@/lib/timezone';
import { cn } from '@/lib/utils';

interface PunchEvent {
  time: string;
  type: 'segment_start' | 'segment_end';
  label: string;
  entry: any;
  segment: any;
  segmentType: string;
}

interface EmployeePunchListProps {
  entries: any[];
  onSegmentEdit?: (event: PunchEvent) => void;
}

const getSegmentLabel = (type: string) => {
  switch(type) {
    case 'hours_driving': return 'Șofer';
    case 'hours_passenger': return 'Pasager';
    case 'hours_equipment': return 'Utilaj';
    case 'hours_night': return 'Noapte';
    case 'hours_holiday': return 'Sărbătoare';
    case 'hours_regular': return 'Normal';
    default: return 'Necunoscut';
  }
};

export const EmployeePunchList = ({ entries, onSegmentEdit }: EmployeePunchListProps) => {
  // Construim lista de evenimente din segmente
  const events: PunchEvent[] = [];
  
  entries.forEach(entry => {
    const segments = entry.time_entry_segments || entry.segments || [];
    
    // Deduplicare prin ID pentru a evita afișarea duplicatelor
    const uniqueSegments = Array.from(
      new Map(segments.map((s: any) => [s.id, s])).values()
    );
    
    uniqueSegments.forEach((segment: any) => {
      const segType = segment.segment_type || segment.type;
      
      // Intrare segment
      events.push({
        time: segment.start_time,
        type: 'segment_start',
        label: `Intrare ${getSegmentLabel(segType)}`,
        entry,
        segment,
        segmentType: segType,
      });
      
      // Ieșire segment
      events.push({
        time: segment.end_time,
        type: 'segment_end',
        label: `Ieșire ${getSegmentLabel(segType)}`,
        entry,
        segment,
        segmentType: segType,
      });
    });
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
        <button
          key={idx}
          onClick={() => onSegmentEdit?.(event)}
          disabled={!onSegmentEdit}
          className={cn(
            "flex items-center gap-3 text-sm w-full text-left p-1 rounded transition-colors",
            onSegmentEdit && "hover:bg-muted/50 cursor-pointer"
          )}
        >
          <span className={cn(
            "w-36 font-medium flex items-center gap-1",
            event.type === 'segment_start' 
              ? "text-green-600 dark:text-green-400" 
              : "text-red-600 dark:text-red-400"
          )}>
            {event.label}
            {onSegmentEdit && <span className="text-xs">✏️</span>}
          </span>
          <span className="text-muted-foreground">-</span>
          <span className="font-mono text-foreground">
            {formatRomania(event.time, 'HH:mm')}
          </span>
        </button>
      ))}
    </div>
  );
};
