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

    console.log("Starting automated data cleanup based on retention policies");

    // Get all active retention policies
    const { data: policies, error: policiesError } = await supabaseAdmin
      .from("data_retention_policies")
      .select("*")
      .eq("auto_delete_enabled", true);

    if (policiesError) {
      throw policiesError;
    }

    if (!policies || policies.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active retention policies found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);
      const cutoffDateStr = cutoffDate.toISOString();

      console.log(`Processing policy: ${policy.data_type}, retention: ${policy.retention_days} days`);

      let deletedCount = 0;

      switch (policy.data_type) {
        case "biometric_photos":
          // Delete old reference photos from profiles
          const { data: oldProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, reference_photo_url, reference_photo_enrolled_at")
            .lt("reference_photo_enrolled_at", cutoffDateStr)
            .not("reference_photo_url", "is", null);

          if (oldProfiles && oldProfiles.length > 0) {
            for (const profile of oldProfiles) {
              if (profile.reference_photo_url) {
                const photoPath = profile.reference_photo_url.split("/").pop();
                if (photoPath) {
                  await supabaseAdmin.storage
                    .from("profile-photos")
                    .remove([`${profile.id}/${photoPath}`]);
                }
              }
            }

            await supabaseAdmin
              .from("profiles")
              .update({
                reference_photo_url: null,
                photo_quality_score: null,
                reference_photo_enrolled_at: null,
              })
              .in("id", oldProfiles.map((p) => p.id));

            deletedCount = oldProfiles.length;
          }
          break;

        case "gps_coordinates":
          // Anonymize old GPS data in time_entries
          const { count: gpsCount } = await supabaseAdmin
            .from("time_entries")
            .update({
              clock_in_latitude: null,
              clock_in_longitude: null,
              clock_out_latitude: null,
              clock_out_longitude: null,
            })
            .lt("clock_in_time", cutoffDateStr)
            .not("clock_in_latitude", "is", null);

          deletedCount = gpsCount || 0;
          break;

        case "face_verifications":
          // Delete old face verification logs
          const { count: faceCount } = await supabaseAdmin
            .from("face_verification_logs")
            .delete()
            .lt("created_at", cutoffDateStr);

          deletedCount = faceCount || 0;
          break;

        case "time_entries":
          // This is typically disabled, but if enabled, delete very old time entries
          const { data: oldTimeEntries } = await supabaseAdmin
            .from("time_entries")
            .select("id, user_id, clock_in_photo_url, clock_out_photo_url")
            .lt("clock_in_time", cutoffDateStr);

          if (oldTimeEntries && oldTimeEntries.length > 0) {
            // Delete associated photos
            for (const entry of oldTimeEntries) {
              const photoPaths: string[] = [];
              if (entry.clock_in_photo_url) {
                const path = entry.clock_in_photo_url.split("/").pop();
                if (path) photoPaths.push(`${entry.user_id}/${path}`);
              }
              if (entry.clock_out_photo_url) {
                const path = entry.clock_out_photo_url.split("/").pop();
                if (path) photoPaths.push(`${entry.user_id}/${path}`);
              }

              if (photoPaths.length > 0) {
                await supabaseAdmin.storage
                  .from("profile-photos")
                  .remove(photoPaths);
              }
            }

            // Delete time entry segments first (foreign key)
            await supabaseAdmin
              .from("time_entry_segments")
              .delete()
              .in("time_entry_id", oldTimeEntries.map((te) => te.id));

            // Delete time entries
            const { count: timeEntriesCount } = await supabaseAdmin
              .from("time_entries")
              .delete()
              .lt("clock_in_time", cutoffDateStr);

            deletedCount = timeEntriesCount || 0;
          }
          break;
      }

      // Update last cleanup run
      await supabaseAdmin
        .from("data_retention_policies")
        .update({ last_cleanup_run: new Date().toISOString() })
        .eq("id", policy.id);

      results.push({
        data_type: policy.data_type,
        retention_days: policy.retention_days,
        deleted_count: deletedCount,
        cutoff_date: cutoffDateStr,
      });

      console.log(`Completed cleanup for ${policy.data_type}: ${deletedCount} records processed`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data cleanup completed",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in cleanup-old-data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
