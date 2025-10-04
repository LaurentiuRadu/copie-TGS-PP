import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Invalid authentication");
    }

    console.log(`Starting GDPR data export for user ${user.id}`);

    // Create GDPR request log
    await supabaseAdmin
      .from("gdpr_requests")
      .insert({
        user_id: user.id,
        request_type: "data_export",
        status: "completed",
        processed_at: new Date().toISOString(),
      });

    // Gather all user data
    const exportData: any = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
    };

    // Profile data
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    exportData.profile = profile;

    // User roles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id);
    exportData.roles = roles;

    // User consents
    const { data: consents } = await supabaseAdmin
      .from("user_consents")
      .select("*")
      .eq("user_id", user.id);
    exportData.consents = consents;

    // Time entries
    const { data: timeEntries } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("clock_in_time", { ascending: false });
    exportData.time_entries = timeEntries;

    // Time entry segments
    if (timeEntries && timeEntries.length > 0) {
      const timeEntryIds = timeEntries.map((te) => te.id);
      const { data: segments } = await supabaseAdmin
        .from("time_entry_segments")
        .select("*")
        .in("time_entry_id", timeEntryIds);
      exportData.time_entry_segments = segments;
    }

    // Face verification logs
    const { data: faceVerifications } = await supabaseAdmin
      .from("face_verification_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    exportData.face_verification_logs = faceVerifications;

    // Active sessions
    const { data: sessions } = await supabaseAdmin
      .from("active_sessions")
      .select("*")
      .eq("user_id", user.id);
    exportData.active_sessions = sessions;

    // Vacation requests
    const { data: vacations } = await supabaseAdmin
      .from("vacation_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    exportData.vacation_requests = vacations;

    // Weekly schedules
    const { data: schedules } = await supabaseAdmin
      .from("weekly_schedules")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start_date", { ascending: false });
    exportData.weekly_schedules = schedules;

    // Security alerts related to user
    const { data: alerts } = await supabaseAdmin
      .from("security_alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    exportData.security_alerts = alerts;

    // Password tracking
    const { data: passwordTracking } = await supabaseAdmin
      .from("user_password_tracking")
      .select("*")
      .eq("user_id", user.id);
    exportData.password_tracking = passwordTracking;

    // GDPR requests history
    const { data: gdprRequests } = await supabaseAdmin
      .from("gdpr_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false });
    exportData.gdpr_requests = gdprRequests;

    console.log(`GDPR data export completed for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: exportData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in gdpr-export-user-data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
