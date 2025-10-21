import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { PasswordChangeDialog } from '@/components/PasswordChangeDialog';
import { GDPRConsentDialog } from '@/components/GDPRConsentDialog';
import { checkUserConsents } from '@/lib/gdprHelpers';
import { iosStorage } from '@/lib/iosStorage';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';
import { useSessionMonitor } from '@/hooks/useSessionMonitor';
import { logger } from '@/lib/logger';

type UserRole = 'admin' | 'employee' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [needsGDPRConsent, setNeedsGDPRConsent] = useState(false);
  const navigate = useNavigate();

  useSessionMonitor(user?.id, !loading && !!user);

  const TOKEN_KEY_REFRESH = 'pwa_auth_refresh_token';
  const TOKEN_KEY_ACCESS = 'pwa_auth_access_token';

  useEffect(() => {
    logger.debug('[AuthProvider] Mounting auth provider');

    const abortController = new AbortController();
    let mounted = true;

    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        logger.warn('[AuthProvider] Safety timeout reached - forcing loading to false');
        setLoading(false);
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || abortController.signal.aborted) return;

        logger.debug('[AuthProvider] Auth state changed:', { event, hasSession: !!session });

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setUserRole(null);
          iosStorage.removeItem(TOKEN_KEY_ACCESS).catch(() => {});
          iosStorage.removeItem(TOKEN_KEY_REFRESH).catch(() => {});
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
          if (session?.access_token && session?.refresh_token) {
            iosStorage.setItem(TOKEN_KEY_ACCESS, session.access_token).catch(() => {});
            iosStorage.setItem(TOKEN_KEY_REFRESH, session.refresh_token).catch(() => {});
          }
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          setSession(session);
          setUser(session.user);

          if (session?.access_token && session?.refresh_token) {
            iosStorage.setItem(TOKEN_KEY_ACCESS, session.access_token).catch(() => {});
            iosStorage.setItem(TOKEN_KEY_REFRESH, session.refresh_token).catch(() => {});
          }

          try {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!mounted || abortController.signal.aborted) return;

            const role = (roleData?.role as UserRole) ?? null;
            setUserRole(role);

            const { data: pwData } = await supabase
              .from('user_password_tracking')
              .select('must_change_password')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!mounted || abortController.signal.aborted) return;

            if (pwData?.must_change_password) {
              setNeedsPasswordChange(true);
            }

            if (role === 'employee') {
              const hasConsents = await checkUserConsents(session.user.id);
              if (!mounted || abortController.signal.aborted) return;
              if (!hasConsents) {
                setNeedsGDPRConsent(true);
              }
            }
          } catch (err) {
            if (!mounted || abortController.signal.aborted) return;
            logger.error('[AuthProvider] Post-login checks error:', err);
          }
        }

        if (event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.access_token && session?.refresh_token) {
            iosStorage.setItem(TOKEN_KEY_ACCESS, session.access_token).catch(() => {});
            iosStorage.setItem(TOKEN_KEY_REFRESH, session.refresh_token).catch(() => {});
          }
        }
      }
    );

    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted || abortController.signal.aborted) return;

        if (error) {
          logger.error('[AuthProvider] Session fetch error:', error);
          if (mounted && !abortController.signal.aborted) {
            setLoading(false);
          }
          return;
        }

        if (session) {
          logger.debug('[AuthProvider] Initial session found');
          setSession(session);
          setUser(session.user);

          try {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!mounted || abortController.signal.aborted) return;

            const role = (roleData?.role as UserRole) ?? null;
            setUserRole(role);

            const { data: pwData } = await supabase
              .from('user_password_tracking')
              .select('must_change_password')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!mounted || abortController.signal.aborted) return;

            if (pwData?.must_change_password) {
              setNeedsPasswordChange(true);
            }

            if (role === 'employee') {
              const hasConsents = await checkUserConsents(session.user.id);
              if (!mounted || abortController.signal.aborted) return;
              if (!hasConsents) {
                setNeedsGDPRConsent(true);
              }
            }
          } catch (err) {
            if (!mounted || abortController.signal.aborted) return;
            logger.error('[AuthProvider] Initial role fetch error:', err);
            setUserRole(null);
          }
        } else {
          logger.debug('[AuthProvider] No initial session');
        }
      })
      .catch((err) => {
        if (!mounted || abortController.signal.aborted) return;
        logger.error('[AuthProvider] Session fetch exception:', err);
        if (mounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      })
      .finally(() => {
        if (mounted && !abortController.signal.aborted) {
          logger.debug('[AuthProvider] Initial load complete, setting loading to false');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      abortController.abort();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !userRole) return;

    const abortController = new AbortController();
    const sessionId = generateDeviceFingerprint();
    const userId = session.user.id;
    let mounted = true;

    (async () => {
      if (!mounted || abortController.signal.aborted) return;

      try {
        const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';
        const { data: existingSession } = await supabase
          .from(tableName)
          .select('id, invalidated_at')
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .maybeSingle();

        if (!mounted || abortController.signal.aborted) return;

        if (existingSession && !existingSession.invalidated_at) {
          await supabase
            .from(tableName)
            .update({
              last_activity: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', existingSession.id);
        } else {
          const { registerActiveSession } = await import('@/lib/auth/sessionHelpers');
          await registerActiveSession(userId, sessionId, userRole);
        }

        if (!mounted || abortController.signal.aborted) return;

        const currentPath = window.location.pathname;
        const adminPaths = ['/dashboard', '/admin', '/time-entries', '/timesheet', '/work-locations', '/alerts', '/face-verifications', '/bulk-import', '/user-management', '/vacations', '/weekly-schedules', '/edit-team-schedule', '/gdpr-admin', '/settings', '/backup-restore'];
        const employeePaths = ['/mobile', '/vacations', '/settings', '/gdpr-settings'];

        const isOnValidPath = (userRole === 'admin' && (adminPaths.some(path => currentPath.startsWith(path)) || employeePaths.some(path => currentPath.startsWith(path)))) ||
                             (userRole === 'employee' && employeePaths.some(path => currentPath.startsWith(path)));

        if (!isOnValidPath && currentPath !== '/auth' && currentPath !== '/admin-login') {
          if (userRole === 'admin') {
            navigate('/admin');
          } else if (userRole === 'employee') {
            navigate('/mobile');
          }
        }
      } catch (error) {
        if (!mounted || abortController.signal.aborted) return;
        logger.error('[AuthContext] Session setup error:', error);
      }
    })();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [session?.user?.id, userRole, navigate]);

  const signOut = async () => {
    logger.info('[AuthProvider] Manual sign out triggered');

    try {
      await supabase.auth.signOut();
      await iosStorage.removeItem(TOKEN_KEY_ACCESS);
      await iosStorage.removeItem(TOKEN_KEY_REFRESH);
    } catch (error) {
      logger.error('[AuthProvider] Error during sign out:', error);
    }

    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signOut }}>
      {loading ? (
        <LoadingScreen onForceReload={() => {
          logger.warn('[AuthProvider] Force reload triggered by user');
          window.location.reload();
        }} />
      ) : (
        <>
          {children}
          <PasswordChangeDialog
            open={needsPasswordChange}
            onSuccess={() => {
              setNeedsPasswordChange(false);
              window.location.reload();
            }}
          />
          {user && needsGDPRConsent && (
            <GDPRConsentDialog
              userId={user.id}
              onConsentsGiven={() => {
                setNeedsGDPRConsent(false);
                window.location.reload();
              }}
            />
          )}
        </>
      )}
    </AuthContext.Provider>
  );
}

function LoadingScreen({ onForceReload }: { onForceReload: () => void }) {
  const [showReloadButton, setShowReloadButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowReloadButton(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted-foreground">Se încarcă...</p>
        {showReloadButton && (
          <div className="space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Încărcarea durează mai mult decât de obicei
            </p>
            <button
              onClick={onForceReload}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Reîncarcă pagina
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
