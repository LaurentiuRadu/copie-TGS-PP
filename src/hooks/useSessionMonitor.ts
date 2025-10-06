import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';

/**
 * Hook care monitorizează validitatea sesiunii curente
 * Verifică periodic dacă sesiunea a fost invalidată de pe alt dispozitiv
 */
export function useSessionMonitor(userId: string | undefined, enabled: boolean = true) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId || !enabled) return;

    const sessionId = generateDeviceFingerprint();
    
    // Verifică dacă sesiunea curentă este validă
    const checkSessionValidity = async () => {
      try {
        const { data, error } = await supabase
          .from('active_sessions')
          .select('invalidated_at, invalidation_reason')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('[SessionMonitor] Error checking session:', error);
          return;
        }

        // Dacă sesiunea a fost invalidată, delogăm utilizatorul
        if (data?.invalidated_at) {
          console.warn('[SessionMonitor] Session invalidated, logging out');
          
          const reason = data.invalidation_reason === 'session_limit_exceeded' 
            ? 'Ai fost delogat automat deoarece te-ai conectat de pe alt dispozitiv.'
            : 'Sesiunea ta a fost închisă.';
          
          toast.error(reason);
          
          // Delogare
          await supabase.auth.signOut();
          navigate('/auth');
        }
      } catch (error) {
        console.error('[SessionMonitor] Error:', error);
      }
    };

    // Verifică imediat
    checkSessionValidity();

    // Verifică la fiecare 30 de secunde
    const interval = setInterval(checkSessionValidity, 30000);

    // Setup realtime subscription pentru invalidări instant
    const channel = supabase
      .channel(`session-monitor-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new.session_id === sessionId && payload.new.invalidated_at) {
            console.warn('[SessionMonitor] Realtime: Session invalidated');
            checkSessionValidity();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [userId, enabled, navigate]);
}
