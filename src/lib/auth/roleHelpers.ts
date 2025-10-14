/**
 * Pure helper functions for role management
 * 
 * These functions handle role derivation and validation without side effects.
 * Used by AuthContext to determine user roles from DB data.
 */

export type UserRole = 'admin' | 'employee' | null;

/**
 * Derives a single primary role from an array of roles
 * Priority: admin > employee > null
 * 
 * @param roles - Array of role strings from user_roles table
 * @returns The primary role for the user
 * 
 * TODO: Implement role priority logic
 * - Check if 'admin' exists in roles array → return 'admin'
 * - Check if 'employee' exists in roles array → return 'employee'
 * - Otherwise return null
 */
export function deriveUserRole(roles: string[]): UserRole {
  // TODO: Implement role derivation
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('employee')) return 'employee';
  return null;
}

/**
 * Ensures a user has at least the 'employee' role
 * If no roles exist, adds 'employee' role to the database
 * 
 * @param userId - UUID of the user
 * @param existingRoles - Current roles from DB
 * @returns Promise<boolean> - true if role was added, false if already exists
 * 
 * TODO: Implement auto-role assignment
 * - Check if existingRoles is empty or undefined
 * - If empty, insert { user_id: userId, role: 'employee' } into user_roles table
 * - Handle errors gracefully (log but don't throw)
 * - Return true if insertion was successful
 */
export async function ensureEmployeeRole(
  userId: string,
  existingRoles: string[]
): Promise<boolean> {
  // Skip if user already has roles assigned
  if (existingRoles && existingRoles.length > 0) {
    return false;
  }

  try {
    // Dynamically import supabase to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: 'employee' });

    if (error) {
      console.error('[roleHelpers] Failed to auto-assign employee role:', error);
      return false;
    }

    console.log('[roleHelpers] ✅ Auto-assigned "employee" role to user:', userId);
    return true;
  } catch (err) {
    console.error('[roleHelpers] Exception during role assignment:', err);
    return false;
  }
}

/**
 * Validates that a role string is a valid UserRole
 * Used for type narrowing from database strings
 */
export function isValidRole(role: string): role is 'admin' | 'employee' {
  return role === 'admin' || role === 'employee';
}
