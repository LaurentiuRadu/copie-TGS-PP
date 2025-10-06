import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function GDPRDataManager() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    if (!user) return;

    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdpr-export-user-data", {
        body: {},
      });

      if (error) throw error;

      // Download as JSON file
      const dataStr = JSON.stringify(data.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Datele au fost exportate cu succes");
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast.error("Eroare la exportul datelor: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteData = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("gdpr-delete-user-data", {
        body: {},
      });

      if (error) throw error;

      toast.success("Datele tale au fost șterse. Vei fi deconectat.");
      
      // Sign out user
      setTimeout(async () => {
        await supabase.auth.signOut();
      }, 2000);
    } catch (error: any) {
      console.error("Error deleting data:", error);
      toast.error("Eroare la ștergerea datelor: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drepturile Tale GDPR</CardTitle>
        <CardDescription>
          Exportă sau șterge datele tale personale conform GDPR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Export Data */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <h3 className="font-medium">Exportă Datele Mele</h3>
                <p className="text-sm text-muted-foreground">
                  Descarcă o copie a tuturor datelor personale pe care le deținem despre tine, 
                  în format JSON.
                </p>
                <Button
                  onClick={handleExportData}
                  disabled={exporting}
                  variant="outline"
                  size="sm"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se exportă...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Exportă Datele
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Delete Data */}
          <div className="p-4 border border-destructive/50 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1 space-y-2">
                <h3 className="font-medium text-destructive">Șterge Datele Mele</h3>
                <p className="text-sm text-muted-foreground">
                  Șterge permanent toate datele tale personale, inclusiv fotografiile, 
                  locațiile GPS și istoricul pontajelor. Această acțiune este ireversibilă.
                </p>
                <Alert className="bg-destructive/10 border-destructive/20">
                  <AlertDescription className="text-xs">
                    <strong>Atenție:</strong> După ștergere, contul tău va fi anonimizat 
                    și nu vei mai putea accesa aplicația. Istoricul pontajelor va fi păstrat 
                    pentru conformitate legală, dar fără date personale identificabile.
                  </AlertDescription>
                </Alert>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleting}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Se șterge...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Șterge Datele Mele
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ești absolut sigur?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Această acțiune nu poate fi anulată. Toate datele tale personale 
                        vor fi șterse permanent din sistemul nostru, inclusiv:
                        <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
                          <li>Fotografiile biometrice</li>
                          <li>Coordonatele GPS</li>
                          <li>Informațiile de contact</li>
                          <li>Istoricul de verificări faciale</li>
                          <li>Sesiunile active</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anulează</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Da, șterge totul
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Pentru întrebări despre procesarea datelor tale sau pentru a exercita alte drepturi GDPR, 
            contactează administratorul sistemului.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
