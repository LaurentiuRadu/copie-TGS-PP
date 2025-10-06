import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { userId, firstName, lastName } = await req.json();

    if (!userId || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, firstName, lastName' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const fullName = `${firstName} ${lastName}`;
    // Generate username from full name (lowercase, no spaces)
    const username = `${firstName}${lastName}`.toLowerCase().replace(/\s+/g, '');

    console.log(`Updating user ${userId}: fullName="${fullName}", username="${username}"`);

    // Use upsert to handle both insert and update cases
    const { error: upsertError } = await supabaseClient
      .from('profiles')
      .upsert({ 
        id: userId,
        full_name: fullName,
        username: username
      }, {
        onConflict: 'id'
      });

    if (upsertError) {
      console.error('Error upserting user profile:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to update user profile' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`User ${userId} updated successfully: ${fullName} (${username})`);

    return new Response(
      JSON.stringify({ 
        message: 'User updated successfully',
        user: { id: userId, fullName }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in update-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
