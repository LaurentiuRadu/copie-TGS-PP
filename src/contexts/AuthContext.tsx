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

  // Monitorizează sesiunea pentru a detecta delogări de pe alte dispozitive
  useSessionMonitor(user?.id, !loading && !!user);

  // Chei pentru backup tokenuri în IndexedDB (iOS PWA)
  const SB_AUTH_KEY = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;
  const TOKEN_KEY_REFRESH = 'pwa_auth_refresh_token';
  const TOKEN_KEY_ACCESS = 'pwa_auth_access_token';


  useEffect(() => {
    logger.info('[AuthProvider] Mounting auth provider');
    
    // AbortController pentru cleanup
    const abortController = new AbortController();
    
    // Listener pentru când aplicația devine vizibilă din nou (important pentru iOS)
    const handleVisibilityChange = async () => {
      if (abortController.signal.aborted) return;
      
      if (!document.hidden) {
        logger.info('[AuthProvider] App became visible, checking session...');
        try {
          // Try to get session from Supabase first
          const { data: { session } } = await supabase.auth.getSession();
          
          if (abortController.signal.aborted) return;
          
          if (session) {
            logger.info('[AuthProvider] Session still valid after visibility change');
            setSession(session);
            setUser(session.user);
          } else {
            // If no session, try to restore from backup tokens (iOS)
            logger.info('[AuthProvider] No session found, attempting restore from backup...');
            const refreshToken = await iosStorage.getItem(TOKEN_KEY_REFRESH);
            const accessToken = await iosStorage.getItem(TOKEN_KEY_ACCESS);
            
            if (abortController.signal.aborted) return;
            
            if (refreshToken && accessToken) {
              logger.info('[AuthProvider] Restoring session from backup tokens');
              const { data, error } = await supabase.auth.setSession({
                refresh_token: refreshToken,
                access_token: accessToken,
              });
              
              if (abortController.signal.aborted) return;
              
              if (!error && data.session) {
                logger.info('[AuthProvider] Session restored successfully');
                setSession(data.session);
                setUser(data.session.user);
              } else {
                logger.warn('[AuthProvider] Could not restore session:', error?.message);
                // Only clear if tokens are truly invalid
                if (error?.message?.includes('invalid') || error?.message?.includes('expired')) {
                  await iosStorage.removeItem(TOKEN_KEY_ACCESS);
                  await iosStorage.removeItem(TOKEN_KEY_REFRESH);
                  setSession(null);
                  setUser(null);
                  setUserRole(null);
                }
              }
            } else {
              logger.warn('[AuthProvider] No backup tokens available');
              setSession(null);
              setUser(null);
              setUserRole(null);
            }
          }
        } catch (error) {
          if (abortController.signal.aborted) return;
          logger.error('[AuthProvider] Error checking session on visibility change:', error);
        }
      }
    };

    // iOS PWA: Verificare suplimentară la focus (când utilizatorul revine în app)
    const handleFocus = async () => {
      if (abortController.signal.aborted) return;
      
      logger.info('[AuthProvider] App focused, verifying session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (abortController.signal.aborted) return;
        
        if (!session) {
          // Try backup restore
          const refreshToken = await iosStorage.getItem(TOKEN_KEY_REFRESH);
          if (refreshToken) {
            logger.info('[AuthProvider] Attempting session restore on focus...');
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: refreshToken,
            });
            
            if (abortController.signal.aborted) return;
            
            if (!error && data.session) {
              logger.info('[AuthProvider] Session restored on focus');
              setSession(data.session);
              setUser(data.session.user);
            }
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        logger.error('[AuthProvider] Error on focus check:', error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Încercare de restaurare sesiune din backup (iOS Firefox PWA)
    (async () => {
      if (abortController.signal.aborted) return;
      
      try {
        await iosStorage.init();
        const refreshToken = await iosStorage.getItem(TOKEN_KEY_REFRESH);
        const accessToken = await iosStorage.getItem(TOKEN_KEY_ACCESS);
        const hasLocal = !!localStorage.getItem(SB_AUTH_KEY);
        
        if (abortController.signal.aborted) return;
        
        if (refreshToken && !hasLocal) {
          logger.info('[AuthProvider] Restoring session from backup tokens');
          const { data, error } = await supabase.auth.setSession({
            refresh_token: refreshToken,
            access_token: accessToken || '',
          });
          
          if (abortController.signal.aborted) return;
          
          if (error) {
            logger.warn('[AuthProvider] Could not restore session from tokens:', error.message);
          } else if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      } catch (e) {
        if (abortController.signal.aborted) return;
        logger.warn('[AuthProvider] Backup restore skipped:', e);
      }
    })();

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.info('[AuthProvider] Auth state changed:', { 
          event, 
          hasSession: !!session,
          userId: session?.user?.id,
          timestamp: new Date().toISOString() 
        });
        
        // Handle SIGNED_OUT immediately
        if (event === 'SIGNED_OUT') {
          logger.warn('[AuthProvider] User signed out detected');
          setSession(null);
          setUser(null);
          setUserRole(null);
          // Curăță backup tokenuri
          iosStorage.removeItem(TOKEN_KEY_ACCESS).catch(() => {});
          iosStorage.removeItem(TOKEN_KEY_REFRESH).catch(() => {});
          return;
        }
        
        // Prevent unnecessary re-authentication on TOKEN_REFRESHED
        if (event === 'TOKEN_REFRESHED') {
          logger.info('[AuthProvider] Token refreshed, keeping current state');
          setSession(session);
          // Don't reset user or trigger role fetch again
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);

        // Backup tokenuri pentru iOS Firefox PWA
        if (session?.access_token && session?.refresh_token) {
          iosStorage.setItem(TOKEN_KEY_ACCESS, session.access_token).catch(() => {});
          iosStorage.setItem(TOKEN_KEY_REFRESH, session.refresh_token).catch(() => {});
        }

        // Don't process further if no user
        if (!session?.user) {
          setUserRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        logger.info('[AuthProvider] Initial session check:', { 
          hasSession: !!session,
          userId: session?.user?.id 
        });
        if (session) {
          setSession(session);
          setUser(session.user);
        } else {
          // Don't overwrite existing state if listener already populated it
          // Keep current user/session as-is
        }

        if (session?.user) {
          try {
            const { data: roleData, error: fetchError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (fetchError) {
              console.error('Role fetch error:', fetchError);
              setUserRole(null);
              return;
            }
            
            let role = (roleData?.role as UserRole) ?? null;
            setUserRole(role);
            
            // Check if password change is required
            const { data: pwData } = await (supabase as any)
              .from('user_password_tracking')
              .select('must_change_password')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (pwData?.must_change_password) {
              setNeedsPasswordChange(true);
            }

            // Check GDPR consents - only for employees
            if (role === 'employee') {
              const hasConsents = await checkUserConsents(session.user.id);
              if (!hasConsents) {
                setNeedsGDPRConsent(true);
              }
            }
          } catch (err) {
            console.error('Role fetch error:', err);
            setUserRole(null);
          }
        }
      })
      .catch((err) => {
        logger.error('Session fetch error:', err);
      })
      .finally(() => {
        logger.info('[AuthProvider] Auth initialization complete');
        setLoading(false);
      });

    return () => {
      abortController.abort();
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Effect 2: Session registration when user authenticates
  useEffect(() => {
    if (!session?.user) return;

    const abortController = new AbortController();
    const sessionId = generateDeviceFingerprint();
    const deviceFingerprint = generateDeviceFingerprint();
    const userId = session.user.id;

    (async () => {
      if (abortController.signal.aborted) return;

      try {
        logger.info('[AuthContext] Registering session for device:', sessionId.substring(0, 8));
        
        // Verifică dacă există deja o sesiune activă pentru acest device
        const { data: existingSession } = await supabase
          .from('active_sessions')
          .select('id, invalidated_at')
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .abortSignal(abortController.signal)
          .maybeSingle();
        
        if (abortController.signal.aborted) return;
        
        if (existingSession && !existingSession.invalidated_at) {
          // Sesiune existentă validă - doar actualizează timestamp
          logger.info('[AuthContext] Updating existing session');
          await supabase
            .from('active_sessions')
            .update({ 
              last_activity: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', existingSession.id)
            .abortSignal(abortController.signal);
        } else {
          // Sesiune nouă sau invalidată - verifică limita și creează
          logger.info('[AuthContext] Creating new session, checking limits...');
          const { data: limitCheck, error: limitError } = await supabase.rpc('check_session_limit', {
            _user_id: userId,
            _session_id: sessionId,
            _device_fingerprint: deviceFingerprint
          });
          
          if (abortController.signal.aborted) return;
          
          if (limitError) {
            logger.error('[AuthContext] Session limit check failed:', limitError);
            return;
          }
          
          const limitResult = limitCheck as { allowed?: boolean; action?: string; message?: string };
          logger.info('[AuthContext] Limit check result:', limitResult);
          
          if (limitResult?.allowed) {
            // Șterge sesiunea veche invalidată dacă există
            if (existingSession?.invalidated_at) {
              await supabase
                .from('active_sessions')
                .delete()
                .eq('id', existingSession.id)
                .abortSignal(abortController.signal);
            }
            
            if (abortController.signal.aborted) return;
            
            // Înregistrează noua sesiune
            const { error: insertError } = await supabase
              .from('active_sessions')
              .insert({
                user_id: userId,
                session_id: sessionId,
                device_fingerprint: deviceFingerprint,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              })
              .abortSignal(abortController.signal);
            
            if (insertError) {
              logger.error('[AuthContext] Failed to insert session:', insertError);
            } else {
              logger.info('[AuthContext] Session registered successfully');
            }
          } else {
            logger.warn('[AuthContext] Session not allowed:', limitResult?.message);
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        logger.error('[AuthContext] Session registration error:', error);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id]);

  // Effect 3: Role fetch and redirect
  useEffect(() => {
    if (!session?.user) return;

    const abortController = new AbortController();
    const userId = session.user.id;

    (async () => {
      if (abortController.signal.aborted) return;

      try {
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .abortSignal(abortController.signal)
          .maybeSingle();

        if (abortController.signal.aborted) return;

        if (error) {
          console.error('Role fetch error:', error);
          setUserRole(null);
          return;
        }

        let role = (roleData?.role as UserRole) ?? null;
        setUserRole(role);

        // Redirect logic
        const currentPath = window.location.pathname;
        const adminPaths = ['/admin', '/time-entries', '/timesheet', '/work-locations', '/alerts', '/face-verifications', '/bulk-import', '/user-management', '/vacations', '/weekly-schedules', '/gdpr-admin', '/settings', '/backup-restore'];
        const employeePaths = ['/mobile', '/vacations', '/settings', '/gdpr-settings'];
        
        // Admins can access BOTH admin and employee areas; employees only employee paths
        const isOnValidPath = (role === 'admin' && (adminPaths.some(path => currentPath.startsWith(path)) || employeePaths.some(path => currentPath.startsWith(path)))) ||
                             (role === 'employee' && employeePaths.some(path => currentPath.startsWith(path)));
        
        if (!isOnValidPath) {
          logger.info('[AuthProvider] Redirecting user - invalid path for role:', { currentPath, role });
          if (role === 'admin') {
            navigate('/admin');
          } else if (role === 'employee') {
            navigate('/mobile');
          }
        } else {
          logger.info('[AuthProvider] User on valid path, no redirect needed:', currentPath);
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        logger.error('[AuthContext] Role fetch error:', error);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, navigate]);

  // Effect 4: Password change check
  useEffect(() => {
    if (!session?.user) return;

    const abortController = new AbortController();
    const userId = session.user.id;

    (async () => {
      if (abortController.signal.aborted) return;

      try {
        const { data: pwData } = await supabase
          .from('user_password_tracking')
          .select('must_change_password')
          .eq('user_id', userId)
          .abortSignal(abortController.signal)
          .maybeSingle();

        if (abortController.signal.aborted) return;

        if (pwData?.must_change_password) {
          setNeedsPasswordChange(true);
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('Password tracking check error:', error);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id]);

  // Effect 5: GDPR consent check (only for employees)
  useEffect(() => {
    if (!session?.user || !userRole) return;
    if (userRole !== 'employee') return;

    const abortController = new AbortController();
    const userId = session.user.id;

    (async () => {
      if (abortController.signal.aborted) return;

      try {
        const hasConsents = await checkUserConsents(userId);

        if (abortController.signal.aborted) return;

        if (!hasConsents) {
          setNeedsGDPRConsent(true);
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('GDPR consent check error:', error);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, userRole]);

  const signOut = async () => {
    console.log('[AuthProvider] 🚪 Manual sign out triggered');
    
    // Cleanup session data
    try {
      await supabase.auth.signOut();
      await iosStorage.removeItem(TOKEN_KEY_ACCESS);
      await iosStorage.removeItem(TOKEN_KEY_REFRESH);
    } catch (error) {
      console.error('[AuthProvider] Error during sign out:', error);
    }
    
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signOut }}>
      {loading ? (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Se încarcă...</p>
          </div>
        </div>
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
