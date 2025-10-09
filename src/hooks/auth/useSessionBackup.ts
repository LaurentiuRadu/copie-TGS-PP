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
 * 
 * TODO Implementation:
 * 1. Detect iOS PWA environment (standalone mode)
 * 2. On session change: backup to IndexedDB via iosStorage.setItem()
 * 3. On mount: try to restore from IndexedDB if no current session
 * 4. Use supabase.auth.setSession() to restore session
 * 5. On logout (session === null): clear IndexedDB backup
 * 6. Handle errors gracefully (log but don't break auth flow)
 */
export function useSessionBackup(currentSession: Session | null) {
  const isIosPwa = useRef(false);
  const hasAttemptedRestore = useRef(false);

  useEffect(() => {
    // Detect iOS PWA environment
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    isIosPwa.current = isIos && isStandalone;

    console.debug('[useSessionBackup] Environment:', {
      isIos,
      isStandalone,
      isIosPwa: isIosPwa.current
    });
  }, []);

  // Backup session on change
  useEffect(() => {
    if (!isIosPwa.current) return;

    const backupSession = async () => {
      try {
        if (currentSession) {
          // TODO: Backup session to IndexedDB
          await iosStorage.setItem(
            'supabase-session-backup',
            JSON.stringify(currentSession)
          );
          console.debug('[useSessionBackup] Session backed up');
        } else {
          // Clear backup on logout
          await iosStorage.removeItem('supabase-session-backup');
          console.debug('[useSessionBackup] Backup cleared');
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
          console.debug('[useSessionBackup] Session already exists, no restore needed');
          return;
        }

        // TODO: Try to restore from IndexedDB
        const backupStr = await iosStorage.getItem('supabase-session-backup');
        if (!backupStr) {
          console.debug('[useSessionBackup] No backup found');
          return;
        }

        const backupSession = JSON.parse(backupStr) as Session;
        
        // Validate expiry
        const expiresAt = backupSession.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt < now) {
          console.warn('[useSessionBackup] Backup expired');
          await iosStorage.removeItem('supabase-session-backup');
          return;
        }

        // Restore session
        const { error } = await supabase.auth.setSession({
          access_token: backupSession.access_token,
          refresh_token: backupSession.refresh_token,
        });

        if (error) {
          console.error('[useSessionBackup] Restore failed:', error);
        } else {
          console.log('[useSessionBackup] ✅ Session restored from backup');
        }
      } catch (error) {
        console.error('[useSessionBackup] Restore exception:', error);
      }
    };

    // Delay restore to avoid race with normal auth
    const timer = setTimeout(restoreSession, 500);
    return () => clearTimeout(timer);
  }, []);
}
