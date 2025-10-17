import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsePasswordPolicyResult {
  mustChangePassword: boolean;
  loading: boolean;
  showPasswordDialog: boolean;
  setShowPasswordDialog: (show: boolean) => void;
}

/**
 * Hook for enforcing password change policy
 * 
 * Responsibilities:
 * - Check user_password_tracking.must_change_password flag
 * - Show PasswordChangeDialog if flag is true
 * - Handle dialog state
 * 
 * @param userId - UUID of the current user
 * @returns {UsePasswordPolicyResult} Password policy state and controls
 */
export function usePasswordPolicy(userId: string | undefined): UsePasswordPolicyResult {
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMustChangePassword(false);
      setShowPasswordDialog(false);
      setLoading(false);
      return;
    }

    const checkPasswordPolicy = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_password_tracking')
          .select('must_change_password')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('[usePasswordPolicy] Error:', error);
          setMustChangePassword(false);
        } else if (data) {
          const needsChange = data.must_change_password || false;
          setMustChangePassword(needsChange);
          setShowPasswordDialog(needsChange);
        }
      } catch (error) {
        console.error('[usePasswordPolicy] Exception:', error);
        setMustChangePassword(false);
      } finally {
        setLoading(false);
      }
    };

    checkPasswordPolicy();
  }, [userId]);

  return {
    mustChangePassword,
    loading,
    showPasswordDialog,
    setShowPasswordDialog,
  };
}
