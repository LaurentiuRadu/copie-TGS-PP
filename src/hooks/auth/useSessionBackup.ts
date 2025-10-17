import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { iosStorage } from '@/lib/iosStorage';

/**
 * Hook for iOS PWA session backup and restoration
 * 
 * Problem: iOS PWAs clear localStorage on app restart, causing logout
 * Solution: Use IndexedDB (via iosStorage) as backup storage
 * 
 * Responsibilities:
 * - Backup session to IndexedDB on every auth state change
 * - Attempt to restore session from IndexedDB on mount (iOS only)
 * - Clear backup on logout
 * 
 * @param currentSession - Current Supabase session (from onAuthStateChange)
 */
export function useSessionBackup(currentSession: Session | null) {
  const isIosPwa = useRef(false);
  const hasAttemptedRestore = useRef(false);

  useEffect(() => {
    // Detect iOS PWA environment
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    isIosPwa.current = isIos && isStandalone;
  }, []);

  // Backup session on change
  useEffect(() => {
    if (!isIosPwa.current) return;

    const backupSession = async () => {
      try {
        if (currentSession) {
          await iosStorage.setItem(
            'supabase-session-backup',
            JSON.stringify(currentSession)
          );
        } else {
          // Clear backup on logout
          await iosStorage.removeItem('supabase-session-backup');
        }
      } catch (error) {
        console.error('[useSessionBackup] Backup failed:', error);
      }
    };

    backupSession();
  }, [currentSession]);

  // Restore session on mount
  useEffect(() => {
    if (!isIosPwa.current || hasAttemptedRestore.current) return;
    hasAttemptedRestore.current = true;

    const restoreSession = async () => {
      try {
        // Only restore if no current session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          return;
        }

        const backupStr = await iosStorage.getItem('supabase-session-backup');
        if (!backupStr) {
          return;
        }

        const backupSession = JSON.parse(backupStr) as Session;
        
        // Validate expiry
        const expiresAt = backupSession.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt < now) {
          await iosStorage.removeItem('supabase-session-backup');
          return;
        }

        // Restore session
        await supabase.auth.setSession({
          access_token: backupSession.access_token,
          refresh_token: backupSession.refresh_token,
        });
      } catch (error) {
        console.error('[useSessionBackup] Restore exception:', error);
      }
    };

    // Delay restore to avoid race with normal auth
    const timer = setTimeout(restoreSession, 500);
    return () => clearTimeout(timer);
  }, []);
}
