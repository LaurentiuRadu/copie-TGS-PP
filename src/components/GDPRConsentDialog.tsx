import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface GDPRConsentDialogProps {
  userId: string;
  onConsentsGiven: () => void;
}

const requiredConsents = [
  {
    type: "biometric_data",
    title: "Date Biometrice",
    description: "Procesarea fotografiilor pentru verificarea identității la pontaj"
  },
  {
    type: "gps_tracking",
    title: "Localizare GPS",
    description: "Colectarea coordonatelor GPS pentru validarea locației la pontaj"
  },
  {
    type: "photo_capture",
    title: "Capturare Fotografii",
    description: "Realizarea de fotografii la pontaj pentru verificarea identității"
  },
  {
    type: "data_processing",
    title: "Procesare Date Personale",
    description: "Procesarea datelor personale pentru evidența timpului de lucru"
  }
];

export function GDPRConsentDialog({ userId, onConsentsGiven }: GDPRConsentDialogProps) {
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [loading, setLoading] = useState(false);

  const allConsentsGiven = requiredConsents.every(consent => consents[consent.type]) && acceptedPolicy;

  const handleSubmit = async () => {
    if (!allConsentsGiven) {
      toast.error("Trebuie să accepți toate consimțămintele pentru a continua");
      return;
    }

    setLoading(true);
    try {
      const consentData = requiredConsents.map(consent => ({
        user_id: userId,
        consent_type: consent.type,
        consent_given: true,
        consent_date: new Date().toISOString(),
        consent_withdrawn_date: null,
        ip_address: null,
        user_agent: navigator.userAgent,
      }));

      for (const consent of consentData) {
        const { error } = await supabase
          .from("user_consents")
          .upsert(consent, {
            onConflict: "user_id,consent_type"
          });

        if (error) throw error;
      }

      toast.success("Consimțăminte salvate cu succes");
      onConsentsGiven();
    } catch (error: any) {
      console.error("Error saving consents:", error);
      toast.error("Eroare la salvarea consimțămintelor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <AlertDialogTitle className="text-2xl">Consimțăminte GDPR Obligatorii</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-2">
            <p>
              Pentru a utiliza aplicația de pontaj, este necesar să accepți procesarea următoarelor 
              date personale conform GDPR. Aceste consimțăminte sunt obligatorii pentru funcționarea 
              aplicației.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                Politica de Confidențialitate <ExternalLink className="h-3 w-3" />
              </Link>
              <span>•</span>
              <Link to="/terms" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                Termeni și Condiții <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-6">
          {requiredConsents.map((consent) => (
            <div
              key={consent.type}
              className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/50"
            >
              <Checkbox
                id={consent.type}
                checked={consents[consent.type] || false}
                onCheckedChange={(checked) => {
                  setConsents(prev => ({
                    ...prev,
                    [consent.type]: checked as boolean
                  }));
                }}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor={consent.type}
                  className="text-base font-semibold cursor-pointer"
                >
                  {consent.title}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {consent.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-4 border-2 border-primary/50 rounded-lg bg-primary/5">
            <Checkbox
              id="accept-policy"
              checked={acceptedPolicy}
              onCheckedChange={(checked) => setAcceptedPolicy(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label
                htmlFor="accept-policy"
                className="text-sm font-semibold cursor-pointer leading-tight"
              >
                Am citit și accept Politica de Confidențialitate și Termenii și Condițiile *
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Acest acord este obligatoriu pentru a utiliza aplicația
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg border text-sm">
            <p className="font-medium mb-2">Notă Importantă:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Poți retrage consimțămintele oricând din Setări GDPR & Confidențialitate</li>
              <li>Retragerea consimțămintelor va face imposibilă utilizarea aplicației de pontaj</li>
              <li>Datele tale vor fi procesate exclusiv conform politicii de confidențialitate</li>
              <li>Ai dreptul la acces, rectificare, ștergere și portabilitate date</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!allConsentsGiven || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se salvează...
              </>
            ) : (
              "Accept toate consimțămintele și continui"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
