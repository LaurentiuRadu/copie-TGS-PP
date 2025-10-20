import { supabase } from '@/integrations/supabase/client';
import { generateDeviceFingerprint, getDeviceInfo } from '@/lib/deviceFingerprint';
import { logger } from '@/lib/logger';

type UserRole = 'admin' | 'employee';

/**
 * Registers an active session in the role-specific table
 * 
 * Purpose:
 * - Track active sessions for security monitoring (separate for admin/employee)
 * - Enforce different concurrent session limits per role
 * - Enable "logout from other devices" functionality
 * 
 * @param userId - UUID of the authenticated user
 * @param sessionId - Generated session ID
 * @param userRole - User's role ('admin' or 'employee')
 * @returns Promise<void>
 */
export async function registerActiveSession(
  userId: string,
  sessionId: string,
  userRole: UserRole
): Promise<void> {
  try {
    const deviceFingerprint = generateDeviceFingerprint();
    const deviceInfo = getDeviceInfo();
    const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';
    const maxSessions = userRole === 'admin' ? 4 : 1;

    // Check current active sessions count
    const { data: countData } = await supabase.rpc(
      'get_active_sessions_count',
      { _user_id: userId, _role: userRole }
    );

    const activeCount = countData || 0;

    // If at or over limit, invalidate oldest session
    if (activeCount >= maxSessions) {
      logger.warn(`[sessionHelpers] Session limit reached for ${userRole} (${activeCount}/${maxSessions})`);
      
      // Get oldest session to invalidate
      const { data: oldestSession } = await supabase
        .from(tableName)
        .select('session_id')
        .eq('user_id', userId)
        .is('invalidated_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (oldestSession) {
        await supabase.rpc('invalidate_sessions_by_role', {
          _user_id: userId,
          _role: userRole,
          _reason: 'session_limit_exceeded',
          _exclude_session_id: oldestSession.session_id
        });
      }
    }

    // Insert new session into role-specific table
    const { error: insertError } = await supabase
      .from(tableName)
      .insert({
        user_id: userId,
        session_id: sessionId,
        device_fingerprint: deviceFingerprint,
        device_info: deviceInfo,
        last_activity: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

    if (insertError) {
      logger.error(`[sessionHelpers] Failed to register ${userRole} session:`, insertError);
    } else {
      logger.info(`[sessionHelpers] ✅ Registered ${userRole} session: ${sessionId}`);
    }
  } catch (error) {
    logger.error('[sessionHelpers] Exception during session registration:', error);
  }
}

/**
 * Updates last_activity timestamp for an active session
 * Should be called periodically to keep session alive
 * 
 * @param sessionId - Session ID
 * @param userRole - User's role ('admin' or 'employee')
 * @returns Promise<void>
 */
export async function updateSessionActivity(
  sessionId: string,
  userRole: UserRole
): Promise<void> {
  try {
    const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';
    
    const { error } = await supabase
      .from(tableName)
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (error) {
      logger.error(`[sessionHelpers] Failed to update ${userRole} session activity:`, error);
    }
  } catch (error) {
    logger.error('[sessionHelpers] Exception updating session activity:', error);
  }
}

/**
 * Invalidates an active session (logout)
 * 
 * @param sessionId - Session ID to invalidate
 * @param userRole - User's role ('admin' or 'employee')
 * @returns Promise<void>
 */
export async function invalidateSession(
  sessionId: string,
  userRole: UserRole
): Promise<void> {
  try {
    const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';
    
    const { error } = await supabase
      .from(tableName)
      .update({ 
        invalidated_at: new Date().toISOString(),
        invalidation_reason: 'user_logout' 
      })
      .eq('session_id', sessionId);

    if (error) {
      logger.error(`[sessionHelpers] Failed to invalidate ${userRole} session:`, error);
    } else {
      logger.info(`[sessionHelpers] ✅ Invalidated ${userRole} session: ${sessionId}`);
    }
  } catch (error) {
    logger.error('[sessionHelpers] Exception invalidating session:', error);
  }
}
