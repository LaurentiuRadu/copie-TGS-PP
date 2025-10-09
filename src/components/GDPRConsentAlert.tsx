import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { checkUserConsents } from "@/lib/gdprHelpers";

/**
 * Banner persistent pentru utilizatorii care nu au acordat toate consimțămintele GDPR
 * Afișat pe toate paginile până când utilizatorul completează consimțămintele
 */
export function GDPRConsentAlert() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [showAlert, setShowAlert] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Nu afișăm banner-ul pentru admini sau dacă nu avem user
    if (!user || roleLoading) {
      setShowAlert(false);
      return;
    }

    // Skip verificare consimțăminte pentru admini
    if (isAdmin) {
      setShowAlert(false);
      return;
    }

    // Verifică consimțăminte DOAR pentru angajați
    const checkConsents = async () => {
      const hasAllConsents = await checkUserConsents(user.id);
      setShowAlert(!hasAllConsents);
    };

    checkConsents();
  }, [user, isAdmin, roleLoading]);

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
