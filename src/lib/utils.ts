import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeTimeInput(value: string): string {
  // Elimină non-digits pentru a detecta input-uri ca "1700"
  const digits = value.replace(/\D/g, '');
  
  let normalized = value; // Default: păstrează originalul
  
  // Dacă avem exact 4 cifre: "1700" → "17:00"
  if (digits.length === 4) {
    const hours = digits.substring(0, 2);
    const minutes = digits.substring(2, 4);
    normalized = `${hours}:${minutes}`;
  } 
  // Dacă avem 3 cifre: "830" → "08:30"
  else if (digits.length === 3) {
    const hours = digits.substring(0, 1).padStart(2, '0');
    const minutes = digits.substring(1, 3);
    normalized = `${hours}:${minutes}`;
  } 
  // Dacă avem 2 cifre: "17" → "17:00"
  else if (digits.length === 2) {
    normalized = `${digits}:00`;
  } 
  // Dacă avem 1 cifră: "8" → "08:00"
  else if (digits.length === 1) {
    normalized = `0${digits}:00`;
  }
  
  // Validare: Verifică dacă timpul normalizat este valid
  if (normalized.includes(':')) {
    const [hoursStr, minutesStr] = normalized.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    // Respinge ore > 23 sau minute > 59
    if (hours > 23 || minutes > 59 || isNaN(hours) || isNaN(minutes)) {
      return value; // Invalid → returnează originalul neschimbat
    }
  }
  
  return normalized; // Valid → returnează timpul normalizat
}
