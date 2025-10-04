import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordCheckRequest {
  password: string;
}

interface PasswordStrength {
  isStrong: boolean;
  score: number;
  feedback: string[];
  isCompromised?: boolean;
}

// Check password against Have I Been Pwned API using k-anonymity
async function checkPwnedPassword(password: string): Promise<boolean> {
  try {
    // Create SHA-1 hash of password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Use k-anonymity: send only first 5 characters
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'TimeTrack-App',
      },
    });

    if (!response.ok) {
      console.error("HIBP API error:", response.status);
      return false; // Don't block user if API fails
    }

    const text = await response.text();
    const hashes = text.split('\n');

    // Check if our suffix appears in the response
    for (const line of hashes) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        console.log(`Password found in ${count.trim()} breaches`);
        return true; // Password is compromised
      }
    }

    return false; // Password not found in breaches
  } catch (error) {
    console.error("Error checking pwned password:", error);
    return false; // Don't block user if check fails
  }
}

function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check (minimum 12 characters)
  if (password.length < 12) {
    feedback.push("Parola trebuie să aibă minimum 12 caractere");
  } else {
    score += 25;
    if (password.length >= 16) score += 10;
  }

  // Uppercase letters
  if (!/[A-Z]/.test(password)) {
    feedback.push("Parola trebuie să conțină cel puțin o literă majusculă");
  } else {
    score += 20;
  }

  // Lowercase letters
  if (!/[a-z]/.test(password)) {
    feedback.push("Parola trebuie să conțină cel puțin o literă mică");
  } else {
    score += 20;
  }

  // Numbers
  if (!/\d/.test(password)) {
    feedback.push("Parola trebuie să conțină cel puțin o cifră");
  } else {
    score += 20;
  }

  // Special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push("Parola trebuie să conțină cel puțin un caracter special");
  } else {
    score += 15;
  }

  // Common patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      feedback.push("Parola conține un pattern comun (ex: 123456, password)");
      score -= 30;
      break;
    }
  }

  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    feedback.push("Parola conține caractere repetitive (ex: aaa, 111)");
    score -= 10;
  }

  const isStrong = score >= 80 && feedback.length === 0;

  return {
    isStrong,
    score: Math.max(0, Math.min(100, score)),
    feedback,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json() as PasswordCheckRequest;

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Checking password strength...");

    // Check password strength
    const strength = validatePasswordStrength(password);

    // Check if password is compromised (only if strong enough)
    let isCompromised = false;
    if (strength.isStrong) {
      console.log("Checking against HIBP database...");
      isCompromised = await checkPwnedPassword(password);
      
      if (isCompromised) {
        strength.isStrong = false;
        strength.feedback.push(
          "⚠️ Această parolă a fost compromisă în breșe de securitate. Alege o altă parolă."
        );
      }
    }

    console.log(`Password strength check completed. Strong: ${strength.isStrong}, Compromised: ${isCompromised}`);

    return new Response(
      JSON.stringify({
        ...strength,
        isCompromised,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in check-password-strength:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
