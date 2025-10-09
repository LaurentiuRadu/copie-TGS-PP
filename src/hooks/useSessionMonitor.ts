import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';

/**
 * Hook care monitorizează validitatea sesiunii curente
 * Verifică periodic dacă sesiunea a fost invalidată de pe alt dispozitiv
 * 
 * Fix-uri PR2:
 * - useRef pentru flag-uri stabile (previne stale closures)
 * - AbortController pentru cleanup complet (previne memory leaks)
 * - Debounce pentru checks paralele (previne race conditions)
 * - Flag ÎNAINTE de logout (previne duplicate logouts)
 */
export function useSessionMonitor(userId: string | undefined, enabled: boolean = true) {
  const navigate = useNavigate();
  
  // ✅ useRef în loc de let - stabil între re-renders
  const isLoggingOutRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingCheckRef = useRef<Promise<void> | null>(null);

  // ✅ useCallback pentru stabilitate
  const checkSessionValidity = useCallback(async () => {
    // ✅ Debounce: dacă deja rulează un check, returnează promisiunea existentă
    if (pendingCheckRef.current) {
      console.log('[SessionMonitor] Check in progress, skipping duplicate');
      return pendingCheckRef.current;
    }

    // ✅ Verifică flag-ul stabil
    if (isLoggingOutRef.current) {
      console.log('[SessionMonitor] Already logging out, skipping check');
      return;
    }

    const sessionId = generateDeviceFingerprint();
    
    // ✅ Creează nou AbortController pentru acest check
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const checkPromise = (async () => {
      try {
        // Verifică mai întâi dacă utilizatorul mai are o sesiune activă în Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession || controller.signal.aborted) {
          console.log('[SessionMonitor] No active session or aborted');
          return;
        }
        
        const { data, error } = await supabase
          .from('active_sessions')
          .select('invalidated_at, invalidation_reason')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .abortSignal(controller.signal)
          .maybeSingle();

        // ✅ Check abort după fiecare operație async
        if (controller.signal.aborted) {
          console.log('[SessionMonitor] Check aborted');
          return;
        }

        if (error) {
          console.error('[SessionMonitor] Error checking session:', error);
          return;
        }

        // Dacă sesiunea a fost invalidată, delogăm utilizatorul
        if (data?.invalidated_at) {
          console.warn('[SessionMonitor] ⚠️ Session invalidated, reason:', data.invalidation_reason);
          
          // ✅ Setăm flag-ul ÎNAINTE de logout pentru a preveni duplicate calls
          isLoggingOutRef.current = true;
          
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
        if (controller.signal.aborted) {
          console.log('[SessionMonitor] Request cancelled');
          return;
        }
        console.error('[SessionMonitor] Error:', error);
      } finally {
        // ✅ Eliberăm lock-ul de debounce
        pendingCheckRef.current = null;
        abortControllerRef.current = null;
      }
    })();

    pendingCheckRef.current = checkPromise;
    return checkPromise;
  }, [userId, navigate]);

  useEffect(() => {
    if (!userId || !enabled) return;

    const sessionId = generateDeviceFingerprint();

    // Nu verifica imediat - lasă AuthContext să termine setup-ul
    const initialCheckTimeout = setTimeout(() => checkSessionValidity(), 5000);

    // Verifică la fiecare 60 de secunde
    const interval = setInterval(() => checkSessionValidity(), 60000);

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

    // ✅ Cleanup complet
    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(interval);
      
      // ✅ Abort orice request în curs
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      channel.unsubscribe();
      
      // ✅ Reset toate ref-urile
      pendingCheckRef.current = null;
      isLoggingOutRef.current = false;
    };
  }, [userId, enabled, checkSessionValidity]);
}
