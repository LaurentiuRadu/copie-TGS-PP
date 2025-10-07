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
    
    let isLoggingOut = false; // Flag pentru a preveni logout-uri multiple
    
    // Verifică dacă sesiunea curentă este validă
    const checkSessionValidity = async () => {
      if (isLoggingOut) {
        console.log('[SessionMonitor] Already logging out, skipping check');
        return;
      }
      
      try {
        // Verifică mai întâi dacă utilizatorul mai are o sesiune activă în Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          console.log('[SessionMonitor] No active Supabase session, skipping database check');
          return;
        }
        
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
          console.warn('[SessionMonitor] ⚠️ Session invalidated, reason:', data.invalidation_reason);
          isLoggingOut = true;
          
          const reason = data.invalidation_reason === 'session_limit_exceeded' 
            ? 'Ai fost delogat automat deoarece te-ai conectat de pe alt dispozitiv.'
            : 'Sesiunea ta a fost închisă.';
          
          toast.error(reason, {
            duration: 5000
          });
          
          // Delogare
          await supabase.auth.signOut();
          navigate('/auth');
        }
      } catch (error) {
        console.error('[SessionMonitor] Error:', error);
      }
    };

    // Nu verifica imediat - lasă AuthContext să termine setup-ul
    const initialCheckTimeout = setTimeout(checkSessionValidity, 5000);

    // Verifică la fiecare 60 de secunde (nu 30, pentru a reduce presiunea)
    const interval = setInterval(checkSessionValidity, 60000);

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
      clearTimeout(initialCheckTimeout);
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [userId, enabled, navigate]);
}
