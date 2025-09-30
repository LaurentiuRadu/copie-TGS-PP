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

  const deriveRoleFromUser = (u: User): Exclude<UserRole, null> | null => {
    const email = u.email || (u.user_metadata as any)?.email || "";
    if (email.endsWith("@employee.local")) return 'employee';
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer role fetching to avoid deadlock
          setTimeout(async () => {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            let role = (roleData?.role as UserRole) ?? null;
            if (!role) {
              const derived = deriveRoleFromUser(session.user);
              if (derived) {
                role = derived;
                setUserRole(role);
                ensureRoleExists(session.user, role);
              } else {
                setUserRole(null);
              }
            } else {
              setUserRole(role);
            }

            // Redirect based on role (fallback to derived for testing)
            if (event === 'SIGNED_IN') {
              if (role === 'admin') {
                navigate('/admin');
              } else {
                navigate('/mobile');
              }
            }
          }, 0);
        } else {
          setUserRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(async ({ data: roleData }) => {
            let role = (roleData?.role as UserRole) ?? deriveRoleFromUser(session.user!);
            setUserRole(role);
            if (!roleData?.role && role) {
              await ensureRoleExists(session.user!, role);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signOut }}>
      {children}
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
