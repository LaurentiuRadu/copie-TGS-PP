import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteRequest {
  userId?: string; // Optional: admin can delete any user, users can only delete themselves
}

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

    const { userId } = await req.json() as DeleteRequest;
    const targetUserId = userId || user.id;

    // Check if user is admin (can delete any user) or deleting their own data
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = roles?.role === "admin";

    if (targetUserId !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: can only delete your own data" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting GDPR data deletion for user ${targetUserId}`);

    // Create GDPR request log
    const { error: requestError } = await supabaseAdmin
      .from("gdpr_requests")
      .insert({
        user_id: targetUserId,
        request_type: "data_deletion",
        status: "processing",
        processed_by: user.id,
      });

    if (requestError) {
      console.error("Error creating GDPR request:", requestError);
    }

    // Delete user's biometric photos from storage
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("reference_photo_url")
      .eq("id", targetUserId)
      .single();

    if (profile?.reference_photo_url) {
      const photoPath = profile.reference_photo_url.split("/").pop();
      if (photoPath) {
        const { error: storageError } = await supabaseAdmin.storage
          .from("profile-photos")
          .remove([`${targetUserId}/${photoPath}`]);
        
        if (storageError) {
          console.error("Error deleting profile photo:", storageError);
        }
      }
    }

    // Delete time entry photos
    const { data: timeEntries } = await supabaseAdmin
      .from("time_entries")
      .select("clock_in_photo_url, clock_out_photo_url")
      .eq("user_id", targetUserId);

    if (timeEntries) {
      const photoPaths: string[] = [];
      timeEntries.forEach((entry) => {
        if (entry.clock_in_photo_url) {
          const path = entry.clock_in_photo_url.split("/").pop();
          if (path) photoPaths.push(`${targetUserId}/${path}`);
        }
        if (entry.clock_out_photo_url) {
          const path = entry.clock_out_photo_url.split("/").pop();
          if (path) photoPaths.push(`${targetUserId}/${path}`);
        }
      });

      if (photoPaths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from("profile-photos")
          .remove(photoPaths);
        
        if (storageError) {
          console.error("Error deleting time entry photos:", storageError);
        }
      }
    }

    // Anonymize GPS coordinates in time_entries (keep records for legal compliance but remove PII)
    const { error: timeEntriesError } = await supabaseAdmin
      .from("time_entries")
      .update({
        clock_in_latitude: null,
        clock_in_longitude: null,
        clock_out_latitude: null,
        clock_out_longitude: null,
        clock_in_photo_url: null,
        clock_out_photo_url: null,
        device_info: null,
        ip_address: null,
        notes: "[DELETED - GDPR REQUEST]",
      })
      .eq("user_id", targetUserId);

    if (timeEntriesError) {
      console.error("Error anonymizing time entries:", timeEntriesError);
    }

    // Delete face verification logs
    await supabaseAdmin
      .from("face_verification_logs")
      .delete()
      .eq("user_id", targetUserId);

    // Delete active sessions
    await supabaseAdmin
      .from("active_sessions")
      .delete()
      .eq("user_id", targetUserId);

    // Delete vacation requests
    await supabaseAdmin
      .from("vacation_requests")
      .delete()
      .eq("user_id", targetUserId);

    // Delete weekly schedules
    await supabaseAdmin
      .from("weekly_schedules")
      .delete()
      .eq("user_id", targetUserId);

    // Delete security alerts
    await supabaseAdmin
      .from("security_alerts")
      .delete()
      .eq("user_id", targetUserId);

    // Delete user consents
    await supabaseAdmin
      .from("user_consents")
      .delete()
      .eq("user_id", targetUserId);

    // Anonymize profile (keep record for referential integrity)
    await supabaseAdmin
      .from("profiles")
      .update({
        username: `deleted_user_${targetUserId.substring(0, 8)}`,
        full_name: "[DELETED]",
        reference_photo_url: null,
        photo_quality_score: null,
        reference_photo_enrolled_at: null,
      })
      .eq("id", targetUserId);

    // Update GDPR request status
    await supabaseAdmin
      .from("gdpr_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("user_id", targetUserId)
      .eq("request_type", "data_deletion")
      .eq("status", "processing");

    console.log(`GDPR data deletion completed for user ${targetUserId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "All personal data has been deleted or anonymized",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in gdpr-delete-user-data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
