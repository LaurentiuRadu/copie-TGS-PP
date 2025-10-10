/**
 * Calendar View Utilities
 * Calculează timesheets pe baza calendaristică (fără Night Rule)
 * pentru afișare în UI, menținând raportarea salarială neschimbată
 */

import { format, parseISO, isSaturday, isSunday, startOfDay, endOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const ROMANIA_TZ = 'Europe/Bucharest';

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  profiles?: {
    id: string;
    username: string | null;
    full_name: string | null;
  };
}

interface CalendarDayHours {
  id: string;
  work_date: string;
  employee_id: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  hours_leave: number;
  hours_medical_leave: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username: string | null;
    full_name: string | null;
  };
}

interface TimeSegment {
  start: Date;
  end: Date;
  type: 'regular' | 'night' | 'saturday' | 'sunday' | 'holiday';
  hours: number;
}

/**
 * Verifică dacă o dată este sărbătoare (stub - trebuie integrat cu tabelul holidays)
 */
function isHoliday(date: Date): boolean {
  // TODO: Integrate with holidays table
  return false;
}

/**
 * Determină tipul de segment bazat pe ora și ziua
 */
function getSegmentType(date: Date): 'regular' | 'night' | 'saturday' | 'sunday' | 'holiday' {
  if (isHoliday(date)) return 'holiday';
  if (isSunday(date)) return 'sunday';
  if (isSaturday(date)) return 'saturday';
  
  const hour = date.getHours();
  // Night hours: 22:00 - 06:00
  if (hour >= 22 || hour < 6) return 'night';
  
  return 'regular';
}

/**
 * Segmentează o tură în intervale de timp pe limite calendaristice
 * (00:00, 06:00, 22:00) FĂRĂ a aplica Night Rule
 */
function segmentTimeEntry(clockIn: Date, clockOut: Date): TimeSegment[] {
  const segments: TimeSegment[] = [];
  let current = clockIn;

  while (current < clockOut) {
    const currentHour = current.getHours();
    let nextBoundary: Date;

    // Determină următoarea limită (00:00, 06:00, sau 22:00)
    if (currentHour < 6) {
      nextBoundary = new Date(current);
      nextBoundary.setHours(6, 0, 0, 0);
    } else if (currentHour < 22) {
      nextBoundary = new Date(current);
      nextBoundary.setHours(22, 0, 0, 0);
    } else {
      // După 22:00, următoarea limită e 00:00 a zilei următoare
      nextBoundary = startOfDay(new Date(current.getTime() + 24 * 60 * 60 * 1000));
    }

    // Capul de segment este fie următoarea limită, fie clock_out
    const segmentEnd = nextBoundary > clockOut ? clockOut : nextBoundary;
    const hours = (segmentEnd.getTime() - current.getTime()) / (1000 * 60 * 60);

    if (hours > 0) {
      segments.push({
        start: current,
        end: segmentEnd,
        type: getSegmentType(current),
        hours
      });
    }

    current = segmentEnd;
  }

  return segments;
}

/**
 * Calculează timesheets pe zile calendaristice din time_entries
 * FĂRĂ Night Rule (orele 00:00-06:00 rămân pe ziua lor actuală)
 */
export function calculateCalendarView(
  timeEntries: TimeEntry[],
  startDate: Date,
  endDate: Date
): CalendarDayHours[] {
  // Map pentru agregare per (employee_id, work_date)
  const dayMap = new Map<string, CalendarDayHours>();

  timeEntries.forEach(entry => {
    if (!entry.clock_out_time || !entry.profiles) return; // Skip incomplete entries or missing profile

    const clockInUtc = parseISO(entry.clock_in_time);
    const clockOutUtc = parseISO(entry.clock_out_time);

    // Convert to Romania timezone
    const clockIn = toZonedTime(clockInUtc, ROMANIA_TZ);
    const clockOut = toZonedTime(clockOutUtc, ROMANIA_TZ);

    // Segmentează tura
    const segments = segmentTimeEntry(clockIn, clockOut);

    // Agregă segmentele pe zile calendaristice
    segments.forEach(segment => {
      const workDate = format(segment.start, 'yyyy-MM-dd');
      const key = `${entry.user_id}:${workDate}`;

      if (!dayMap.has(key)) {
        dayMap.set(key, {
          id: `calendar-${entry.user_id}-${workDate}`, // synthetic ID for calendar view
          work_date: workDate,
          employee_id: entry.user_id,
          hours_regular: 0,
          hours_night: 0,
          hours_saturday: 0,
          hours_sunday: 0,
          hours_holiday: 0,
          hours_passenger: 0,
          hours_driving: 0,
          hours_equipment: 0,
          hours_leave: 0,
          hours_medical_leave: 0,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          profiles: entry.profiles! // guaranteed non-null by check above
        });
      }

      const day = dayMap.get(key)!;

      // Atribuie orele în funcție de tip
      switch (segment.type) {
        case 'night':
          day.hours_night += segment.hours;
          break;
        case 'saturday':
          day.hours_saturday += segment.hours;
          break;
        case 'sunday':
          day.hours_sunday += segment.hours;
          break;
        case 'holiday':
          day.hours_holiday += segment.hours;
          break;
        default:
          day.hours_regular += segment.hours;
      }
    });
  });

  // Filtrează după interval și convertește în array
  return Array.from(dayMap.values())
    .filter(day => {
      const date = parseISO(day.work_date);
      return date >= startDate && date <= endDate;
    })
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
}
