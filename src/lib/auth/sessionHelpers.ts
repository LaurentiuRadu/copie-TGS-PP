import { supabase } from '@/integrations/supabase/client';
import { generateDeviceFingerprint, getDeviceInfo } from '@/lib/deviceFingerprint';

interface SessionLimitCheckResponse {
  allowed: boolean;
  action?: string;
  message?: string;
}

/**
 * Registers an active session in the database
 * 
 * Purpose:
 * - Track active sessions for security monitoring
 * - Enforce concurrent session limits per user
 * - Enable "logout from other devices" functionality
 * 
 * @param userId - UUID of the authenticated user
 * @param sessionId - Supabase session ID (from session.access_token)
 * @returns Promise<void>
 * 
 * TODO Implementation:
 * 1. Generate device fingerprint via generateDeviceFingerprint()
 * 2. Call check_session_limit() RPC to validate concurrent sessions
 * 3. If RPC returns { allowed: false }, show error toast and block
 * 4. If RPC returns { allowed: true, action: 'oldest_session_logged_out' }, show info toast
 * 5. Insert new record into active_sessions table:
 *    - user_id: userId
 *    - session_id: sessionId
 *    - device_fingerprint: generated fingerprint
 *    - device_info: getDeviceInfo() (optional)
 *    - created_at: now()
 *    - expires_at: now() + 24 hours
 *    - last_activity: now()
 * 6. Handle errors gracefully (log but don't break auth)
 */
export async function registerActiveSession(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    console.debug('[sessionHelpers] Registering session for user:', userId);

    // TODO: Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint();
    const deviceInfo = getDeviceInfo();

    // TODO: Check session limit via RPC
    const { data: limitCheck, error: rpcError } = await supabase.rpc(
      'check_session_limit',
      {
        _user_id: userId,
        _session_id: sessionId,
        _device_fingerprint: deviceFingerprint,
      }
    );

    if (rpcError) {
      console.error('[sessionHelpers] Session limit check failed:', rpcError);
      // Continue anyway - don't block login
    } else if (limitCheck) {
      const response = limitCheck as unknown as SessionLimitCheckResponse;
      console.debug('[sessionHelpers] Session limit check result:', response);

      if (!response.allowed) {
        // TODO: Show error toast and potentially block
        console.warn('[sessionHelpers] Session limit exceeded:', response.message);
        // For now, just log - AuthContext will handle UI
      } else if (response.action === 'oldest_session_logged_out') {
        // TODO: Show info toast about auto-logout
        console.info('[sessionHelpers] Auto-logged out oldest session');
      }
    }

    // TODO: Insert into active_sessions table
    const { error: insertError } = await supabase
      .from('active_sessions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        device_fingerprint: deviceFingerprint,
        device_info: deviceInfo,
        last_activity: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[sessionHelpers] Failed to register session:', insertError);
    } else {
      console.debug('[sessionHelpers] ✅ Session registered successfully');
    }
  } catch (error) {
    console.error('[sessionHelpers] Exception during session registration:', error);
  }
}

/**
 * Updates last_activity timestamp for an active session
 * Should be called periodically to keep session alive
 * 
 * @param sessionId - Supabase session ID
 * @returns Promise<void>
 * 
 * TODO Implementation:
 * 1. Update active_sessions SET last_activity = now() WHERE session_id = sessionId
 * 2. Handle errors silently (this is background activity)
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('active_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[sessionHelpers] Failed to update session activity:', error);
    }
  } catch (error) {
    console.error('[sessionHelpers] Exception updating session activity:', error);
  }
}

/**
 * Invalidates an active session (logout)
 * 
 * @param sessionId - Supabase session ID to invalidate
 * @returns Promise<void>
 * 
 * TODO Implementation:
 * 1. Update active_sessions SET invalidated_at = now() WHERE session_id = sessionId
 * 2. This triggers database triggers that may logout other sessions
 * 3. Handle errors silently
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('active_sessions')
      .update({ 
        invalidated_at: new Date().toISOString(),
        invalidation_reason: 'user_logout' 
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[sessionHelpers] Failed to invalidate session:', error);
    } else {
      console.debug('[sessionHelpers] Session invalidated:', sessionId);
    }
  } catch (error) {
    console.error('[sessionHelpers] Exception invalidating session:', error);
  }
}
