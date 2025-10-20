import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';
import { logger } from '@/lib/logger';

/**
 * Hook care monitorizează validitatea sesiunii curente
 * Verifică periodic dacă sesiunea a fost invalidată de pe alt dispozitiv
 */
export function useSessionMonitor(userId: string | undefined, enabled: boolean = true) {
  const navigate = useNavigate();
  
  // useRef în loc de let - stabil între re-renders
  const isLoggingOutRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingCheckRef = useRef<Promise<void> | null>(null);

  // useCallback pentru stabilitate
  const checkSessionValidity = useCallback(async () => {
    // Debounce: dacă deja rulează un check, returnează promisiunea existentă
    if (pendingCheckRef.current) {
      return pendingCheckRef.current;
    }

    // Verifică flag-ul stabil
    if (isLoggingOutRef.current) {
      return;
    }

    const sessionId = generateDeviceFingerprint();
    
    // Creează nou AbortController pentru acest check
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const checkPromise = (async () => {
      try {
        // Verifică mai întâi dacă utilizatorul mai are o sesiune activă în Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession || controller.signal.aborted) {
          return;
        }

        // Determină rolul utilizatorului
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .abortSignal(controller.signal)
          .maybeSingle();

        if (controller.signal.aborted) {
          return;
        }

        const userRole = roleData?.role === 'admin' ? 'admin' : 'employee';
        const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';
        
        logger.info(`[SessionMonitor] User role detected: ${userRole}, using table: ${tableName}`);
        
        const { data, error } = await supabase
          .from(tableName)
          .select('invalidated_at, invalidation_reason')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .abortSignal(controller.signal)
          .maybeSingle();

        // Check abort după fiecare operație async
        if (controller.signal.aborted) {
          return;
        }

        if (error) {
          logger.error('[SessionMonitor] Error checking session:', error);
          return;
        }

        // Dacă sesiunea a fost invalidată, delogăm utilizatorul
        if (data?.invalidated_at) {
          // Setăm flag-ul ÎNAINTE de logout pentru a preveni duplicate calls
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
          return;
        }
        logger.error('[SessionMonitor] Error:', error);
      } finally {
        // Eliberăm lock-ul de debounce
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
    let channels: any[] = [];

    // Setup async pentru a determina tabela corectă
    const setupMonitoring = async () => {
      // Determină rolul utilizatorului
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const userRole = roleData?.role === 'admin' ? 'admin' : 'employee';
      const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';
      
      logger.info(`[SessionMonitor] Setup monitoring for ${userRole} using table: ${tableName}`);

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
            table: tableName,
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            if (payload.new.session_id === sessionId && payload.new.invalidated_at) {
              checkSessionValidity();
            }
          }
        )
        .subscribe();

      channels.push({ initialCheckTimeout, interval, channel });
    };

    setupMonitoring();

    // Cleanup complet
    return () => {
      channels.forEach(({ initialCheckTimeout, interval, channel }) => {
        clearTimeout(initialCheckTimeout);
        clearInterval(interval);
        channel.unsubscribe();
      });
      
      // Abort orice request în curs
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset toate ref-urile
      pendingCheckRef.current = null;
      isLoggingOutRef.current = false;
    };
  }, [userId, enabled, checkSessionValidity]);
}
