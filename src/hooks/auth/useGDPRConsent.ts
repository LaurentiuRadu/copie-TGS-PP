import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseGDPRConsentResult {
  needsConsent: boolean;
  loading: boolean;
  showConsentDialog: boolean;
  setShowConsentDialog: (show: boolean) => void;
}

/**
 * Hook for checking GDPR consent requirements
 * 
 * Responsibilities:
 * - Check if user has given all required GDPR consents
 * - Show GDPRConsentDialog if consents are missing
 * - Only apply to 'employee' role users
 * 
 * Required consents:
 * - biometric_data
 * - gps_tracking
 * - photo_capture
 * - data_processing
 * 
 * @param userId - UUID of the current user
 * @param userRole - Current user role ('admin' | 'employee' | null)
 * @returns {UseGDPRConsentResult} GDPR consent state and controls
 */
export function useGDPRConsent(
  userId: string | undefined,
  userRole: 'admin' | 'employee' | null
): UseGDPRConsentResult {
  const [needsConsent, setNeedsConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConsentDialog, setShowConsentDialog] = useState(false);

  useEffect(() => {
    // Admin users don't need GDPR consent for biometric data
    if (!userId || userRole !== 'employee') {
      setNeedsConsent(false);
      setShowConsentDialog(false);
      setLoading(false);
      return;
    }

    const checkConsents = async () => {
      setLoading(true);
      try {
        const requiredConsents = [
          'biometric_data',
          'gps_tracking',
          'photo_capture',
          'data_processing'
        ];

        const { data, error } = await supabase
          .from('user_consents')
          .select('consent_type, consent_given, consent_withdrawn_date')
          .eq('user_id', userId)
          .in('consent_type', requiredConsents);

        if (error) {
          console.error('[useGDPRConsent] Error:', error);
          setNeedsConsent(false);
        } else {
          // Check if all required consents are given and not withdrawn
          const validConsents = data?.filter(
            consent => consent.consent_given && !consent.consent_withdrawn_date
          ) || [];

          const missingConsents = validConsents.length < requiredConsents.length;
          setNeedsConsent(missingConsents);
          setShowConsentDialog(missingConsents);
        }
      } catch (error) {
        console.error('[useGDPRConsent] Exception:', error);
        setNeedsConsent(false);
      } finally {
        setLoading(false);
      }
    };

    checkConsents();
  }, [userId, userRole]);

  return {
    needsConsent,
    loading,
    showConsentDialog,
    setShowConsentDialog,
  };
}
