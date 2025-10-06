import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

interface Consent {
  id: string;
  consent_type: string;
  consent_given: boolean;
  consent_date: string | null;
  consent_withdrawn_date: string | null;
}

const consentTypes = [
  {
    type: "biometric_data",
    title: "Date Biometrice",
    description: "Procesarea fotografiilor pentru verificarea identității"
  },
  {
    type: "gps_tracking",
    title: "Localizare GPS",
    description: "Colectarea coordonatelor GPS pentru pontaj"
  },
  {
    type: "photo_capture",
    title: "Capturare Fotografii",
    description: "Realizarea de fotografii la pontaj"
  },
  {
    type: "data_processing",
    title: "Procesare Date",
    description: "Procesarea datelor personale pentru evidența timpului de lucru"
  }
];

export function GDPRConsentManager() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadConsents();
    }
  }, [user]);

  const loadConsents = async () => {
    try {
      const { data, error } = await supabase
        .from("user_consents")
        .select("*")
        .eq("user_id", user?.id);

      if (error) throw error;

      setConsents(data || []);
    } catch (error: any) {
      console.error("Error loading consents:", error);
      toast.error("Eroare la încărcarea consimțămintelor");
    } finally {
      setLoading(false);
    }
  };

  const updateConsent = async (consentType: string, given: boolean) => {
    if (!user) return;

    setUpdating(consentType);
    try {
      const existingConsent = consents.find(c => c.consent_type === consentType);

      const consentData = {
        user_id: user.id,
        consent_type: consentType,
        consent_given: given,
        consent_date: given ? new Date().toISOString() : null,
        consent_withdrawn_date: !given ? new Date().toISOString() : null,
        ip_address: null, // Could be populated from server
        user_agent: navigator.userAgent,
      };

      const { error } = await supabase
        .from("user_consents")
        .upsert(consentData, {
          onConflict: "user_id,consent_type"
        });

      if (error) throw error;

      await loadConsents();
      toast.success(
        given 
          ? "Consimțământ acordat" 
          : "Consimțământ retras"
      );
    } catch (error: any) {
      console.error("Error updating consent:", error);
      toast.error("Eroare la actualizarea consimțământului");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Gestionare Consimțăminte GDPR</CardTitle>
        </div>
        <CardDescription>
          Controlează cum sunt procesate datele tale personale conform GDPR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Aceste setări controlează procesarea datelor tale personale. Poți retrage 
            consimțământul în orice moment, dar acest lucru poate afecta funcționalitatea aplicației.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {consentTypes.map((consentType) => {
            const consent = consents.find(c => c.consent_type === consentType.type);
            const isGiven = consent?.consent_given || false;
            const isUpdating = updating === consentType.type;

            return (
              <div
                key={consentType.type}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1 flex-1">
                  <Label htmlFor={consentType.type} className="text-base font-medium">
                    {consentType.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {consentType.description}
                  </p>
                  {consent && (
                    <p className="text-xs text-muted-foreground">
                      {isGiven 
                        ? `Acordat: ${new Date(consent.consent_date!).toLocaleDateString('ro-RO')}`
                        : consent.consent_withdrawn_date 
                          ? `Retras: ${new Date(consent.consent_withdrawn_date).toLocaleDateString('ro-RO')}`
                          : "Nu a fost încă acordat"
                      }
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Switch
                    id={consentType.type}
                    checked={isGiven}
                    onCheckedChange={(checked) => updateConsent(consentType.type, checked)}
                    disabled={isUpdating}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Pentru mai multe informații despre cum procesăm datele tale, consultă 
            politica noastră de confidențialitate sau contactează administratorul.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
