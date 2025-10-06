import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { PasswordChangeDialog } from '@/components/PasswordChangeDialog';
import { GDPRConsentDialog } from '@/components/GDPRConsentDialog';
import { checkUserConsents } from '@/lib/gdprHelpers';

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

  const deriveRoleFromUser = (u: User): Exclude<UserRole, null> | null => {
    const email = u.email || (u.user_metadata as any)?.email || "";
    if (email.endsWith("@company.local")) return 'employee';
    if (email === 'demoadmin@test.com' || email.endsWith('@tgservices.ro')) return 'admin';
    return null;
  };

  const ensureRoleExists = async (u: User, role: Exclude<UserRole, null>) => {
    try {
      await supabase
        .from('user_roles')
        .insert({ user_id: u.id, role });
    } catch (e) {
      // ignore insert errors (duplicate, etc.)
    }
  };

  useEffect(() => {
    console.log('[AuthProvider] 🔧 Mounting auth provider');
    
    // Listener pentru când aplicația devine vizibilă din nou (important pentru iOS)
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('[AuthProvider] 👁️ App became visible, checking session...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('[AuthProvider] ✅ Session still valid after visibility change');
            setSession(session);
            setUser(session.user);
          } else {
            console.warn('[AuthProvider] ⚠️ No session found after visibility change');
            setSession(null);
            setUser(null);
            setUserRole(null);
          }
        } catch (error) {
          console.error('[AuthProvider] ❌ Error checking session on visibility change:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthProvider] 🔔 Auth state changed:', { 
          event, 
          hasSession: !!session,
          userId: session?.user?.id,
          timestamp: new Date().toISOString() 
        });
        
        // Handle SIGNED_OUT immediately
        if (event === 'SIGNED_OUT') {
          console.warn('[AuthProvider] ⚠️ User signed out detected');
          setSession(null);
          setUser(null);
          setUserRole(null);
          return;
        }
        
        // Prevent unnecessary re-authentication on TOKEN_REFRESHED
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AuthProvider] 🔄 Token refreshed, keeping current state');
          setSession(session);
          // Don't reset user or trigger role fetch again
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch role without async in callback  
          setTimeout(() => {
            const userId = session.user.id;
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', userId)
              .maybeSingle()
              .then(({ data: roleData, error }) => {
                if (error) {
                  console.error('Role fetch error:', error);
                  setUserRole(null);
                  return;
                }

                let role = (roleData?.role as UserRole) ?? null;
                if (!role) {
                  const derived = deriveRoleFromUser(session.user);
                  if (derived) {
                    role = derived;
                    setUserRole(role);
                    // Don't await, just fire and forget
                    ensureRoleExists(session.user, role).catch(() => {});
                  } else {
                    setUserRole(null);
                  }
                } else {
                  setUserRole(role);
                }

                // Check if password change is required
                (supabase as any)
                  .from('user_password_tracking')
                  .select('must_change_password')
                  .eq('user_id', userId)
                  .maybeSingle()
                  .then(({ data: pwData }: any) => {
                    if (pwData?.must_change_password) {
                      setNeedsPasswordChange(true);
                    }
                  })
                  .catch((err: any) => console.error('Password tracking check error:', err));

                // Check GDPR consents - only for employees, not admins
                if (role === 'employee') {
                  checkUserConsents(userId)
                    .then((hasConsents) => {
                      if (!hasConsents) {
                        setNeedsGDPRConsent(true);
                      }
                    })
                    .catch((err) => console.error('GDPR consent check error:', err));
                }

                // Only redirect on SIGNED_IN event, not on TOKEN_REFRESHED or other events
                if (event === 'SIGNED_IN') {
                  // Check current path to avoid unnecessary redirects
                  const currentPath = window.location.pathname;
                  
                  // Define valid paths for each role
                  const adminPaths = ['/admin', '/time-entries', '/work-locations', '/alerts', '/face-verifications', '/bulk-import', '/user-management', '/vacations', '/weekly-schedules'];
                  const employeePaths = ['/mobile', '/my-time-entries', '/vacations'];
                  
                  const isOnValidPath = (role === 'admin' && adminPaths.some(path => currentPath.startsWith(path))) ||
                                       (role === 'employee' && employeePaths.some(path => currentPath.startsWith(path)));
                  
                  // Only redirect if user is not on a valid path for their role
                  if (!isOnValidPath) {
                    if (role === 'admin') {
                      navigate('/admin');
                    } else if (role === 'employee') {
                      navigate('/mobile');
                    }
                  }
                }
              });
          }, 0);
        } else {
          setUserRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        console.log('[AuthProvider] 📝 Initial session check:', { 
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
              const derived = deriveRoleFromUser(session.user);
              setUserRole(derived);
              return;
            }
            
            let role = (roleData?.role as UserRole) ?? deriveRoleFromUser(session.user);
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
            
            // Only try to create role if none exists and we have a derived role
            if (!roleData && role) {
              // Check if role already exists before inserting
              const { data: existingRole } = await supabase
                .from('user_roles')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('role', role)
                .maybeSingle();
              
              if (!existingRole) {
                await ensureRoleExists(session.user, role);
              }
            }
          } catch (err) {
            console.error('Role fetch error:', err);
            setUserRole(null);
          }
        }
      })
      .catch((err) => {
        console.error('Session fetch error:', err);
      })
      .finally(() => {
        console.log('[AuthProvider] ✅ Auth initialization complete');
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signOut = async () => {
    console.log('[AuthProvider] 🚪 Manual sign out triggered');
    await supabase.auth.signOut();
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
