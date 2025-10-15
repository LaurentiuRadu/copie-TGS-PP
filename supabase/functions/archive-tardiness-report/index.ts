import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: authError.message 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user) {
      return new Response(
        JSON.stringify({ 
          error: 'No authenticated user found. Please log in again.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('[Archive] Admin check failed:', { user_id: user.id, roleError });
      return new Response(
        JSON.stringify({ 
          error: 'Admin access required',
          details: `User ${user.id} does not have admin role`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { report_id } = await req.json();

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: 'Missing report_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get report to check if it can be archived
    const { data: report, error: fetchError } = await supabase
      .from('tardiness_reports')
      .select('status, is_archived')
      .eq('id', report_id)
      .single();

    if (fetchError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow archiving of processed reports (approved or rejected)
    if (report.status !== 'approved' && report.status !== 'rejected') {
      return new Response(
        JSON.stringify({ error: 'Only processed reports can be archived' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (report.is_archived) {
      return new Response(
        JSON.stringify({ error: 'Report is already archived' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Archive the report
    const { data, error } = await supabase
      .from('tardiness_reports')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: user.id
      })
      .eq('id', report_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`[Archive] Report ${report_id} archived by ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Archive Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
