import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const EMPLOYEES = [
  { fullName: "ABABEI CIPRIAN", username: "ababeiciprian", isAdmin: false },
  { fullName: "ALEXANDRESCU ADRIAN", username: "alexandrescuadrian", isAdmin: true },
  { fullName: "APOSTU CATALINA", username: "apostucatalina", isAdmin: true },
  { fullName: "CANBEI RAZVAN IONUT", username: "canbeirazvan", isAdmin: false },
  { fullName: "CHITICARU FLORIN", username: "chiticaruflorin", isAdmin: false },
  { fullName: "CIOINEA VASILE", username: "cioineavasile", isAdmin: false },
  { fullName: "COSTACHE FLORIN CATALIN", username: "costacheflorin", isAdmin: true },
  { fullName: "COSTACHE MARIUS", username: "costachemarius", isAdmin: false },
  { fullName: "COSTAN IONEL DANUT", username: "costanionel", isAdmin: false },
  { fullName: "FLOREA GHEORGHITA DANIEL", username: "floreagheorghita", isAdmin: false },
  { fullName: "GHINTUIALA GEORGIANA MADALINA", username: "ghintuialageorgiana", isAdmin: true },
  { fullName: "HRISCU COSTEL", username: "hriscucostel", isAdmin: false },
  { fullName: "IFRIM CLAUDIU", username: "ifrimclaudiu", isAdmin: false },
  { fullName: "IFRIM REMUS", username: "ifrimremus", isAdmin: false },
  { fullName: "JIMBU COSTEL", username: "jimbucostel", isAdmin: false },
  { fullName: "JIMBU GABRIEL", username: "jimbugabriel", isAdmin: false },
  { fullName: "JIMBU MARIAN", username: "jimbumarian", isAdmin: false },
  { fullName: "MACIUCA TUDOR BOGDAN", username: "maciucatudor", isAdmin: false },
  { fullName: "MORARU ION", username: "moraruion", isAdmin: false },
  { fullName: "MUNTEANU ADRIAN SORIN", username: "munteanuadrian", isAdmin: false },
  { fullName: "NISTOR BOGDAN IONUT", username: "nistorbogdan", isAdmin: false },
  { fullName: "NISTOR RADU", username: "nistorradu", isAdmin: false },
  { fullName: "RADU COSTEL", username: "raducostel", isAdmin: false },
  { fullName: "RADU IOAN", username: "raduioan", isAdmin: false },
  { fullName: "RADU IOAN LAURENTIU", username: "raduioan2", isAdmin: true },
  { fullName: "RUSU GHEORGHITA", username: "rusugheorghita", isAdmin: false },
  { fullName: "RUSU IONEL", username: "rusuionel", isAdmin: false },
  { fullName: "UNGUREANU MIHAI MADALIN", username: "ungureanumihai", isAdmin: false },
  { fullName: "URSACHE DUMITRU", username: "ursachedumitru", isAdmin: false },
];

export default function BulkImport() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: string[]; errors: { username: string; error: string }[] } | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    setLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-create-users', {
        body: { employees: EMPLOYEES }
      });

      if (error) throw error;

      setResults(data);
      
      if (data.success.length > 0) {
        toast({
          title: "Import finalizat",
          description: `${data.success.length} utilizatori creați cu succes.`,
        });
      }

      if (data.errors.length > 0) {
        toast({
          title: "Erori la import",
          description: `${data.errors.length} utilizatori nu au putut fi creați.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error importing users:', error);
      toast({
        title: "Eroare",
        description: error instanceof Error ? error.message : "A apărut o eroare la import.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">Import Salariați</h1>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="container mx-auto max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle>Import Salariați</CardTitle>
                  <CardDescription>
                    Importă {EMPLOYEES.length} salariați în sistem. Toți vor primi parola temporară "ChangeMe123!" și vor trebui să o schimbe la prima autentificare.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      <strong>Username format:</strong> prenume + nume (ex: ababeiciprian)<br />
                      <strong>Email format:</strong> username@company.local<br />
                      <strong>Parolă temporară:</strong> ChangeMe123!<br />
                      <strong>Administratori:</strong> {EMPLOYEES.filter(e => e.isAdmin).length} persoane
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Lista de import:</h3>
                    <div className="max-h-60 overflow-y-auto border rounded-lg p-4 space-y-1">
                      {EMPLOYEES.map((emp, idx) => (
                        <div key={idx} className="text-sm">
                          {emp.fullName} → <code className="bg-muted px-1 rounded">{emp.username}</code>
                          {emp.isAdmin && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Admin</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleImport} disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Importă Salariați
                  </Button>

                  {results && (
                    <div className="space-y-4 mt-6">
                      {results.success.length > 0 && (
                        <div className="border border-green-500/20 bg-green-500/10 rounded-lg p-4">
                          <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                            ✓ Succes ({results.success.length})
                          </h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {results.success.map((username, idx) => (
                              <div key={idx} className="text-sm">{username}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {results.errors.length > 0 && (
                        <div className="border border-red-500/20 bg-red-500/10 rounded-lg p-4">
                          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                            ✗ Erori ({results.errors.length})
                          </h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {results.errors.map((err, idx) => (
                              <div key={idx} className="text-sm">
                                <strong>{err.username}:</strong> {err.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
