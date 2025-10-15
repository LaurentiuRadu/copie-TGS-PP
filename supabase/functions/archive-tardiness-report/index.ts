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
    const authHeader = req.headers.get('Authorization');
    
    console.log('[Archive] Request received');

    // Validare: trebuie să avem token de autentificare
    if (!authHeader) {
      console.error('[Archive] Missing Authorization header');
      return new Response(
        JSON.stringify({ 
          error_code: 'missing_auth',
          message: 'Lipsește token-ul de autentificare. Te rugăm să te loghezi din nou.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client pentru validare user (folosește token-ul din header)
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Client pentru operațiuni DB (service role, nu suprascrie Authorization)
    const supabaseDB = createClient(supabaseUrl, supabaseServiceKey);

    // Validare user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('[Archive] Auth validation failed:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ 
          error_code: 'auth_failed',
          message: 'Sesiunea ta a expirat. Te rugăm să te autentifici din nou.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificare rol admin
    const { data: roleData, error: roleError } = await supabaseDB
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('[Archive] Admin check failed:', { user_id: user.id, roleError });
      return new Response(
        JSON.stringify({ 
          error_code: 'not_admin',
          message: 'Nu ai permisiuni de administrator pentru această acțiune.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validare input
    const { report_id } = await req.json();

    if (!report_id) {
      console.error('[Archive] Missing report_id');
      return new Response(
        JSON.stringify({ 
          error_code: 'missing_report_id',
          message: 'Lipsește ID-ul raportului.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificare raport existent și validare stare
    const { data: report, error: fetchError } = await supabaseDB
      .from('tardiness_reports')
      .select('status, is_archived')
      .eq('id', report_id)
      .single();

    if (fetchError || !report) {
      console.error('[Archive] Report not found:', report_id);
      return new Response(
        JSON.stringify({ 
          error_code: 'report_not_found',
          message: 'Raportul nu a fost găsit.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificare: doar rapoarte procesate pot fi arhivate
    if (report.status !== 'approved' && report.status !== 'rejected') {
      console.error('[Archive] Report not processed:', { report_id, status: report.status });
      return new Response(
        JSON.stringify({ 
          error_code: 'not_processed',
          message: 'Doar rapoartele procesate (aprobate sau respinse) pot fi arhivate.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificare: raportul nu e deja arhivat
    if (report.is_archived) {
      console.error('[Archive] Report already archived:', report_id);
      return new Response(
        JSON.stringify({ 
          error_code: 'already_archived',
          message: 'Acest raport este deja arhivat.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Arhivare raport (folosim service role client)
    const { data, error } = await supabaseDB
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
      console.error('[Archive] Update failed:', error);
      throw error;
    }

    console.log(`[Archive] ✅ Report ${report_id} archived by ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Archive Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error_code: 'server_error',
        message: 'Eroare la arhivarea raportului. Te rugăm să încerci din nou.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
