import { supabase } from '@/integrations/supabase/client';
import { generateDeviceFingerprint, getDeviceInfo } from '@/lib/deviceFingerprint';
import { logger } from '@/lib/logger';

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
 */
export async function registerActiveSession(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint();
    const deviceInfo = getDeviceInfo();

    // Check session limit via RPC
    const { data: limitCheck, error: rpcError } = await supabase.rpc(
      'check_session_limit',
      {
        _user_id: userId,
        _session_id: sessionId,
        _device_fingerprint: deviceFingerprint,
      }
    );

    if (rpcError) {
      logger.error('[sessionHelpers] Session limit check failed:', rpcError);
      // Continue anyway - don't block login
    } else if (limitCheck) {
      const response = limitCheck as unknown as SessionLimitCheckResponse;

      if (!response.allowed) {
        logger.warn('[sessionHelpers] Session limit exceeded:', response.message);
        // For now, just log - AuthContext will handle UI
      }
    }

    // Insert into active_sessions table
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
      logger.error('[sessionHelpers] Failed to register session:', insertError);
    }
  } catch (error) {
    logger.error('[sessionHelpers] Exception during session registration:', error);
  }
}

/**
 * Updates last_activity timestamp for an active session
 * Should be called periodically to keep session alive
 * 
 * @param sessionId - Supabase session ID
 * @returns Promise<void>
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('active_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (error) {
      logger.error('[sessionHelpers] Failed to update session activity:', error);
    }
  } catch (error) {
    logger.error('[sessionHelpers] Exception updating session activity:', error);
  }
}

/**
 * Invalidates an active session (logout)
 * 
 * @param sessionId - Supabase session ID to invalidate
 * @returns Promise<void>
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
      logger.error('[sessionHelpers] Failed to invalidate session:', error);
    }
  } catch (error) {
    logger.error('[sessionHelpers] Exception invalidating session:', error);
  }
}
