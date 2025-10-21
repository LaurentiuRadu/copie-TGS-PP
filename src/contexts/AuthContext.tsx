import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();


  useEffect(() => {

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event, !!session);

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setUserRole(null);
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          setSession(session);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          setUserRole(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          setSession(session);
          setUser(session.user);

          // Fetch user role
          try {
            const { data: roleData, error: fetchError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (fetchError) {
              console.error('Role fetch error:', fetchError);
              setUserRole(null);
            } else {
              setUserRole((roleData?.role as UserRole) ?? null);
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
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Redirect based on role
  useEffect(() => {
    if (!session?.user || !userRole || loading) return;

    const currentPath = window.location.pathname;
    const authPaths = ['/auth', '/admin-login', '/'];

    if (authPaths.includes(currentPath)) {
      if (userRole === 'admin') {
        navigate('/admin');
      } else if (userRole === 'employee') {
        navigate('/mobile');
      }
    }
  }, [session, userRole, loading, navigate]);

  const signOut = async () => {
    console.log('[AuthProvider] Sign out triggered');

    try {
      await supabase.auth.signOut();
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
        children
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
