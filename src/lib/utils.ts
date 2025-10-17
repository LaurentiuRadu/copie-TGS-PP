import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeTimeInput(value: string): string {
  // Elimină non-digits pentru a detecta input-uri ca "1700"
  const digits = value.replace(/\D/g, '');
  
  // Dacă avem exact 4 cifre: "1700" → "17:00"
  if (digits.length === 4) {
    const hours = digits.substring(0, 2);
    const minutes = digits.substring(2, 4);
    return `${hours}:${minutes}`;
  } 
  // Dacă avem 3 cifre: "830" → "08:30"
  else if (digits.length === 3) {
    const hours = digits.substring(0, 1).padStart(2, '0');
    const minutes = digits.substring(1, 3);
    return `${hours}:${minutes}`;
  } 
  // Dacă avem 2 cifre: "17" → "17:00"
  else if (digits.length === 2) {
    return `${digits}:00`;
  } 
  // Dacă avem 1 cifră: "8" → "08:00"
  else if (digits.length === 1) {
    return `0${digits}:00`;
  }
  
  // Păstrează formatul original dacă nu se potrivește (ex: "17:00" rămâne "17:00")
  return value;
}
