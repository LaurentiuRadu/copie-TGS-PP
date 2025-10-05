import { GDPRConsentManager } from "@/components/GDPRConsentManager";
import { GDPRDataManager } from "@/components/GDPRDataManager";
import { ActiveSessionsManager } from "@/components/ActiveSessionsManager";

export default function GDPRSettings() {
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Setări GDPR & Confidențialitate</h1>
        <p className="text-muted-foreground">
          Gestionează consimțămintele și drepturile tale privind datele personale
        </p>
      </div>

      <GDPRConsentManager />
      <ActiveSessionsManager />
      <GDPRDataManager />
    </div>
  );
}
