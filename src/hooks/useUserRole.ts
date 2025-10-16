import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserRoleHook {
  isAdmin: boolean;
  isEmployee: boolean;
  roles: string[];
  loading: boolean;
}

/**
 * Hook pentru verificare roluri utilizator
 * Returnează toate rolurile user-ului din tabelul user_roles
 * Un user poate avea multiple roluri (ex: ['admin', 'employee'])
 */
export const useUserRole = (): UserRoleHook => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchUserRoles = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('[useUserRole] Error fetching roles:', error);
          setRoles([]);
        } else {
          const userRoles = data?.map(r => r.role) || [];
          setRoles(userRoles);
        }
      } catch (error) {
        console.error('[useUserRole] Exception:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();
  }, [user?.id]);

  const isAdmin = roles.includes('admin');

  return {
    isAdmin,
    isEmployee: roles.includes('employee'),
    roles,
    loading,
  };
};
