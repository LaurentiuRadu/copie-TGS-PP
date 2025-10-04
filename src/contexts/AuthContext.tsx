import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ForcePasswordChange } from '@/components/ForcePasswordChange';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle SIGNED_OUT immediately
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setUserRole(null);
          return;
        }
        
        // Prevent unnecessary re-authentication on TOKEN_REFRESHED
        if (event === 'TOKEN_REFRESHED') {
          setSession(session);
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
                  setUserRole(null);
                  return;
                }

                const role = (roleData?.role as UserRole) ?? null;
                setUserRole(role);

                // Only redirect on SIGNED_IN event
                if (event === 'SIGNED_IN' && role) {
                  const currentPath = window.location.pathname;
                  const adminPaths = ['/admin', '/time-entries', '/work-locations', '/alerts', '/face-verifications', '/bulk-import', '/user-management', '/vacations', '/weekly-schedules', '/timesheet', '/recalculate-segments'];
                  const employeePaths = ['/mobile', '/my-time-entries', '/vacations'];
                  
                  const isOnValidPath = (role === 'admin' && adminPaths.some(path => currentPath.startsWith(path))) ||
                                       (role === 'employee' && employeePaths.some(path => currentPath.startsWith(path)));
                  
                  if (!isOnValidPath) {
                    navigate(role === 'admin' ? '/admin' : '/mobile');
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
        if (session) {
          setSession(session);
          setUser(session.user);
        }

        if (session?.user) {
          try {
            const { data: roleData, error: fetchError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (fetchError) {
              setUserRole(null);
              return;
            }
            
            setUserRole((roleData?.role as UserRole) ?? null);

            // Check if user must change password
            const { data: passwordData } = await supabase
              .from('user_password_tracking')
              .select('must_change_password')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            if (passwordData?.must_change_password) {
              setMustChangePassword(true);
            }
          } catch (err) {
            setUserRole(null);
          }
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setMustChangePassword(false);
    navigate('/auth');
  };

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
  };

  // Enable session timeout monitoring
  useSessionTimeout();

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
          {mustChangePassword && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}
          {children}
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
