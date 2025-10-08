import { GDPRConsentManager } from "@/components/GDPRConsentManager";
import { GDPRDataManager } from "@/components/GDPRDataManager";
import { ActiveSessionsManager } from "@/components/ActiveSessionsManager";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";

export default function GDPRSettings() {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  return (
    <AdminLayout title="GDPR & Confidențialitate">
      <div className="container max-w-4xl py-8 space-y-8">

      {isAdmin ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Administratori GDPR</CardTitle>
            </div>
            <CardDescription>
              Ca administrator, nu trebuie să furnizezi consimțăminte GDPR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Administratorii gestionează datele utilizatorilor în baza acordurilor de confidențialitate 
              și securitate ale companiei. Consimțămintele GDPR sunt necesare doar pentru angajați.
            </p>
          </CardContent>
        </Card>
      ) : (
        <GDPRConsentManager />
      )}
      
        <ActiveSessionsManager />
        <GDPRDataManager />
      </div>
    </AdminLayout>
  );
}
