import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { checkUserConsents } from "@/lib/gdprHelpers";
import { supabase } from "@/integrations/supabase/client";

/**
 * Banner persistent pentru utilizatorii care nu au acordat toate consimțămintele GDPR
 * Afișat pe toate paginile până când utilizatorul completează consimțămintele
 */
export function GDPRConsentAlert() {
  const { user } = useAuth();
  const [showAlert, setShowAlert] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Nu afișăm banner-ul dacă nu avem user
    if (!user) {
      setShowAlert(false);
      return;
    }

    const checkAdminAndConsents = async () => {
      try {
        // ✅ Step 1: Verifică DIRECT dacă e admin (fără dependency pe useUserRole)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError && roleError.code !== 'PGRST116') {
          console.error('[GDPRConsentAlert] Role check error:', roleError);
          setShowAlert(false);
          return;
        }

        // ✅ Admins nu au nevoie de GDPR consent banner
        if (roleData?.role === 'admin') {
          setShowAlert(false);
          return;
        }

        // ✅ Step 2: Pentru employees, verifică consimțăminte
        const hasAllConsents = await checkUserConsents(user.id);
        setShowAlert(!hasAllConsents);
      } catch (error) {
        console.error('[GDPRConsentAlert] Exception:', error);
        setShowAlert(false);
      }
    };

    checkAdminAndConsents();
  }, [user]);

  // Nu afișăm dacă utilizatorul a dat dismiss sau are toate consimțămintele
  if (!showAlert || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert variant="destructive" className="border-destructive">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-bold text-lg">
          Consimțăminte GDPR Obligatorii Lipsă
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Pentru a utiliza aplicația de pontaj, trebuie să acordați toate consimțămintele GDPR obligatorii 
            (date biometrice, GPS, fotografii, procesare date personale).
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/gdpr-settings">
                Completează Consimțămintele
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="ml-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
