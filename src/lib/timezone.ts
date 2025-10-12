import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ro } from 'date-fns/locale';

const ROMANIA_TZ = 'Europe/Bucharest';

export function toRomaniaZoned(input: string | Date): Date {
  const date = typeof input === 'string' ? new Date(input) : input;
  return toZonedTime(date, ROMANIA_TZ);
}

export function formatRomania(input: string | Date, pattern: string): string {
  return format(toRomaniaZoned(input), pattern, { locale: ro });
}

export function nowDeviceIso(): string {
  // Golden rule: use the device clock at the moment of action
  return new Date().toISOString();
}
