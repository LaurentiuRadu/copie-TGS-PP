import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { deriveUserRole, ensureEmployeeRole, type UserRole } from '@/lib/auth/roleHelpers';

interface UseRolesResult {
  userRole: UserRole;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing user roles
 * 
 * Responsibilities:
 * - Fetch roles from user_roles table
 * - Derive primary role (admin > employee)
 * - Auto-assign 'employee' role if user has no roles
 * 
 * @param userId - UUID of the current user (null if not authenticated)
 * @returns {UseRolesResult} Current role, loading state, and refetch function
 */
export function useRoles(userId: string | undefined): UseRolesResult {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    if (!userId) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('[useRoles] Error fetching roles:', error);
        setUserRole(null);
      } else {
        const roles = data?.map(r => r.role) || [];
        
        if (roles.length === 0) {
          const assigned = await ensureEmployeeRole(userId, roles);
          if (assigned) {
            // Refetch after assignment
            await fetchRoles();
            return;
          }
        }

        const derivedRole = deriveUserRole(roles);
        setUserRole(derivedRole);
      }
    } catch (error) {
      console.error('[useRoles] Exception:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [userId]);

  return {
    userRole,
    loading,
    refetch: fetchRoles,
  };
}
