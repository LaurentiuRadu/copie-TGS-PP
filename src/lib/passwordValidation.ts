import { supabase } from "@/integrations/supabase/client";

export interface PasswordStrength {
  isStrong: boolean;
  score: number;
  feedback: string[];
  isCompromised?: boolean;
}

export async function checkPasswordStrength(password: string): Promise<PasswordStrength> {
  try {
    const { data, error } = await supabase.functions.invoke("check-password-strength", {
      body: { password },
    });

    if (error) {
      console.error("Error checking password strength:", error);
      // Return basic validation if API fails
      return {
        isStrong: password.length >= 6,
        score: password.length >= 6 ? 80 : 40,
        feedback: password.length < 6 ? ["Parola trebuie să aibă minimum 6 caractere"] : [],
      };
    }

    return data as PasswordStrength;
  } catch (error) {
    console.error("Error in checkPasswordStrength:", error);
    return {
      isStrong: false,
      score: 0,
      feedback: ["Eroare la verificarea parolei"],
    };
  }
}

export function getPasswordStrengthColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export function getPasswordStrengthLabel(score: number): string {
  if (score >= 80) return "Puternică";
  if (score >= 60) return "Medie";
  if (score >= 40) return "Slabă";
  return "Foarte slabă";
}
