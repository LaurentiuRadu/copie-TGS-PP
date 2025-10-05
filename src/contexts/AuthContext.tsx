import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
// Removed useNavigate to avoid router dependency inside provider
import { ForcePasswordChange } from '@/components/ForcePasswordChange';
import { GDPRConsentDialog } from '@/components/GDPRConsentDialog';

type UserRole = 'admin' | 'employee' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [needsGDPRConsent, setNeedsGDPRConsent] = useState(false);

  const checkGDPRConsents = async (userId: string): Promise<boolean> => {
    try {
      const requiredConsents = ['biometric_data', 'gps_tracking', 'photo_capture', 'data_processing'];
      
      const { data: consents, error } = await supabase
        .from("user_consents")
        .select("consent_type, consent_given, consent_withdrawn_date")
        .eq("user_id", userId)
        .in("consent_type", requiredConsents);

      if (error) {
        console.error("[AuthContext] Error checking consents:", error);
        return true; // Assume needs consent on error
      }

      // Check if all required consents are given and not withdrawn
      const givenConsents = consents?.filter(c => 
        c.consent_given && !c.consent_withdrawn_date
      ).map(c => c.consent_type) || [];

      const needsConsent = requiredConsents.some(
        required => !givenConsents.includes(required)
      );

      console.debug("[AuthContext] GDPR consent check:", { needsConsent, givenConsents });
      return needsConsent;
    } catch (error) {
      console.error("[AuthContext] Unexpected error checking consents:", error);
      return true;
    }
  };

  const handleGDPRConsentsGiven = () => {
    setNeedsGDPRConsent(false);
  };

  useEffect(() => {
    let timeoutRef: NodeJS.Timeout | null = null;
    
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
          timeoutRef = setTimeout(() => {
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

                // Check password and GDPR on SIGNED_IN
                if (event === 'SIGNED_IN') {
                  // Check password change requirement
                  supabase
                    .from('user_password_tracking')
                    .select('must_change_password')
                    .eq('user_id', userId)
                    .maybeSingle()
                    .then(({ data: passwordData }) => {
                      if (passwordData?.must_change_password) {
                        setMustChangePassword(true);
                      }
                    });

                  // Check GDPR consents
                  checkGDPRConsents(userId).then(needsConsent => {
                    setNeedsGDPRConsent(needsConsent);
                  });

                  // Redirect handled by route components (RootRedirect/ProtectedRoute).
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

            // Check GDPR consents
            const needsConsent = await checkGDPRConsents(session.user.id);
            setNeedsGDPRConsent(needsConsent);
          } catch (err) {
            setUserRole(null);
          }
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef) clearTimeout(timeoutRef);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setMustChangePassword(false);
    setNeedsGDPRConsent(false);
    window.location.replace('/auth');
  };

  const handlePasswordChanged = async () => {
    setMustChangePassword(false);
    
    // Re-check GDPR consents after password change
    if (user) {
      const needsConsent = await checkGDPRConsents(user.id);
      setNeedsGDPRConsent(needsConsent);
    }
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
          {mustChangePassword && <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />}
          {!mustChangePassword && needsGDPRConsent && user && (
            <GDPRConsentDialog 
              userId={user.id} 
              onConsentsGiven={handleGDPRConsentsGiven}
            />
          )}
          {!mustChangePassword && !needsGDPRConsent && children}
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
