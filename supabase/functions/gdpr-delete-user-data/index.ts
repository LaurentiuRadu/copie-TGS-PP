import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing deletion request for user:', user.id);

    // Create GDPR deletion request
    const { error: requestError } = await supabaseClient
      .from('gdpr_requests')
      .insert({
        user_id: user.id,
        request_type: 'deletion',
        status: 'pending',
        details: {
          requested_via: 'gdpr_settings',
          timestamp: new Date().toISOString(),
        },
      });

    if (requestError) {
      throw new Error(`Failed to create deletion request: ${requestError.message}`);
    }

    console.log('Deletion request created for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cererea de ștergere a fost înregistrată. Un administrator o va procesa în cel mai scurt timp.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in gdpr-delete-user-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
