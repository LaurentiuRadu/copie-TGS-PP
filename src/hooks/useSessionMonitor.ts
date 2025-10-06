import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook pentru monitorizarea sesiunii active și delogare automată
 * dacă sesiunea a fost invalidată de la alt dispozitiv
 */
export function useSessionMonitor(userId: string | undefined, enabled: boolean = true) {
  const sessionIdRef = useRef<string | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    // Generează un ID unic pentru sesiunea curentă
    if (!sessionIdRef.current) {
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const sessionId = sessionIdRef.current;

    // Înregistrează sesiunea activă
    const registerSession = async () => {
      try {
        const deviceFingerprint = await generateDeviceFingerprint();
        
        // Verifică limita de sesiuni înainte de înregistrare
        const { data: limitCheck, error: limitError } = await supabase.rpc('check_session_limit', {
          _user_id: userId,
          _session_id: sessionId,
          _device_fingerprint: deviceFingerprint
        }) as { data: { allowed: boolean; action: string; message: string } | null; error: any };

        if (!limitError && limitCheck && !(limitCheck as any).allowed) {
          toast.error('Sesiunea a fost închisă - ai fost autentificat pe alt dispozitiv');
          await supabase.auth.signOut();
          return;
        }

        // Înregistrează sau actualizează sesiunea
        await supabase
          .from('active_sessions')
          .upsert({
            user_id: userId,
            session_id: sessionId,
            device_fingerprint: deviceFingerprint,
            last_activity: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
          }, {
            onConflict: 'session_id'
          });

      } catch (error) {
        console.error('[SessionMonitor] Error registering session:', error);
      }
    };

    // Verifică dacă sesiunea a fost invalidată
    const checkSessionValidity = async () => {
      try {
        const { data: session } = await supabase
          .from('active_sessions')
          .select('invalidated_at, invalidation_reason')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (session?.invalidated_at) {
          console.warn('[SessionMonitor] Sesiunea a fost invalidată:', session.invalidation_reason);
          
          const reason = session.invalidation_reason === 'session_limit_exceeded'
            ? 'Ai fost autentificat pe alt dispozitiv'
            : 'Sesiunea ta a fost închisă';
          
          toast.error(reason);
          await supabase.auth.signOut();
        } else {
          // Actualizează last_activity
          await supabase
            .from('active_sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('session_id', sessionId)
            .eq('user_id', userId);
        }
      } catch (error) {
        console.error('[SessionMonitor] Error checking session validity:', error);
      }
    };

    // Înregistrează sesiunea imediat
    registerSession();

    // Verifică validitatea sesiunii la fiecare 30 secunde
    checkIntervalRef.current = setInterval(checkSessionValidity, 30000);

    // Actualizează last_activity la fiecare 5 minute
    const activityInterval = setInterval(() => {
      supabase
        .from('active_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .then(() => {}, () => {});
    }, 5 * 60 * 1000);

    // Cleanup la demount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      clearInterval(activityInterval);

      // Marchează sesiunea ca invalidată la ieșire
      supabase
        .from('active_sessions')
        .update({
          invalidated_at: new Date().toISOString(),
          invalidation_reason: 'user_logout'
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .then(() => {}, () => {});
    };
  }, [userId, enabled]);
}

// Helper pentru generarea unui device fingerprint simplu
async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width + 'x' + screen.height,
    navigator.hardwareConcurrency || 0
  ];
  
  const fingerprint = components.join('|');
  
  // Creează un hash simplu
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}
