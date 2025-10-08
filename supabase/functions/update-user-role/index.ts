import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateRoleRequest {
  userId: string;
  role: 'admin' | 'employee';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[update-user-role] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[update-user-role] Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the requesting user is an admin
    const { data: requestorRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError) {
      console.error('[update-user-role] Error checking requestor role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Error verifying permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = requestorRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      console.error('[update-user-role] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins can change user roles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, role }: UpdateRoleRequest = await req.json();

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId and role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    if (role !== 'admin' && role !== 'employee') {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be "admin" or "employee"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent user from changing their own role
    if (userId === user.id) {
      console.error('[update-user-role] User trying to change own role:', user.id);
      return new Response(
        JSON.stringify({ error: 'Cannot change your own role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-user-role] Changing role for user ${userId} to ${role} by admin ${user.id}`);

    // Delete all existing roles for this user
    const { error: deleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[update-user-role] Error deleting old roles:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Error updating user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the new role
    const { error: insertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (insertError) {
      console.error('[update-user-role] Error inserting new role:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error updating user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-user-role] Successfully changed role for user ${userId} to ${role}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `User role updated to ${role}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-user-role] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
