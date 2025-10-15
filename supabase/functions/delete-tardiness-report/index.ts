import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-supabase-auth, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[Delete] Request received');

  try {
    // 1. AUTH VALIDATION (support both Authorization and X-Supabase-Auth)
    const rawAuth =
      req.headers.get('x-supabase-auth') ||
      req.headers.get('X-Supabase-Auth') ||
      req.headers.get('authorization') ||
      req.headers.get('Authorization');

    if (!rawAuth) {
      console.error('[Delete] Auth header missing (Authorization/X-Supabase-Auth)');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing authorization',
          error_code: 'missing_auth',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove "Bearer " prefix if present
    const token = rawAuth.replace(/^Bearer\s+/i, '');

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[Delete] Auth validation failed:', userError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication failed', 
          error_code: 'auth_failed' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Delete] User authenticated: ${user.id}`);

    // 2. ADMIN CHECK
    const supabaseDB = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roleData, error: roleError } = await supabaseDB
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[Delete] Admin check failed:', roleError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Requires admin privileges', 
          error_code: 'not_admin' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Delete] Admin verified');

    // 3. PARSE REQUEST BODY
    const { report_id } = await req.json();

    if (!report_id) {
      console.error('[Delete] Missing report_id');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing report_id', 
          error_code: 'missing_report_id' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. FETCH REPORT TO VALIDATE
    const { data: report, error: fetchError } = await supabaseDB
      .from('tardiness_reports')
      .select('id, status, is_archived')
      .eq('id', report_id)
      .maybeSingle();

    if (fetchError || !report) {
      console.error('[Delete] Report not found:', report_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Report not found', 
          error_code: 'report_not_found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. VALIDATE STATUS (only approved/rejected/archived can be deleted)
    if (report.status === 'pending') {
      console.error('[Delete] Cannot delete pending report:', report_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Pending reports cannot be deleted. Please approve or reject first.', 
          error_code: 'not_processed' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. DELETE REPORT
    const { error: deleteError } = await supabaseDB
      .from('tardiness_reports')
      .delete()
      .eq('id', report_id);

    if (deleteError) {
      console.error('[Delete] Database error:', deleteError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to delete report', 
          error_code: 'delete_failed' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Delete] ✅ Report ${report_id} deleted successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Report deleted successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Delete] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage, 
        error_code: 'unexpected_error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
