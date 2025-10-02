import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { oldUsername, newUsername } = await req.json();

    console.log('Updating username from', oldUsername, 'to', newUsername);

    // Get user ID from old username
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('username', oldUsername)
      .single();

    if (profileError || !profile) {
      throw new Error('User not found');
    }

    const userId = profile.id;
    const oldEmail = `${oldUsername}@employee.local`;
    const newEmail = `${newUsername}@employee.local`;

    // Update email in auth.users
    const { error: authError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    );

    if (authError) {
      console.error('Auth update error:', authError);
      throw authError;
    }

    // Update username in profiles
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      throw updateError;
    }

    console.log('Successfully updated username and email');

    return new Response(
      JSON.stringify({ success: true, message: 'Username updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
