import { supabase } from "@/integrations/supabase/client";

export type RateLimitType = 'login' | 'api_call' | 'password_reset' | 'data_export';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string | null;
  blocked?: boolean;
}

export async function checkRateLimit(
  identifier: string,
  attemptType: RateLimitType
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke("check-rate-limit", {
      body: {
        identifier,
        attemptType,
      },
    });

    if (error) {
      console.error("Error checking rate limit:", error);
      // Allow request if rate limit check fails (fail open)
      return {
        allowed: true,
        remaining: 999,
        reset_at: null,
      };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.error("Error in checkRateLimit:", error);
    // Allow request if rate limit check fails (fail open)
    return {
      allowed: true,
      remaining: 999,
      reset_at: null,
    };
  }
}

export function formatResetTime(resetAt: string | null): string {
  if (!resetAt) return "";
  
  const resetDate = new Date(resetAt);
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  const diffMins = Math.ceil(diffMs / 60000);

  if (diffMins <= 0) return "în câteva secunde";
  if (diffMins === 1) return "într-un minut";
  if (diffMins < 60) return `în ${diffMins} minute`;
  
  const diffHours = Math.ceil(diffMins / 60);
  if (diffHours === 1) return "într-o oră";
  return `în ${diffHours} ore`;
}
