import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RateLimitRequest {
  identifier: string; // IP address or user ID
  attemptType: 'login' | 'api_call' | 'password_reset' | 'data_export';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { identifier, attemptType } = await req.json() as RateLimitRequest;

    if (!identifier || !attemptType) {
      return new Response(
        JSON.stringify({ error: "Identifier and attemptType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking rate limit for ${identifier} - ${attemptType}`);

    // Call the database function to check rate limit
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      _identifier: identifier,
      _attempt_type: attemptType,
    });

    if (error) {
      console.error("Error checking rate limit:", error);
      throw error;
    }

    console.log("Rate limit check result:", data);

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in check-rate-limit:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
