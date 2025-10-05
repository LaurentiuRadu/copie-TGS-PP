import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import * as XLSX from 'xlsx';

const EMPLOYEES = [
  { fullName: "ABABEI CIPRIAN", username: "ababeiciprian", isAdmin: false },
  { fullName: "ALEXANDRESCU ADRIAN", username: "alexandrescuadrian", isAdmin: false },
  { fullName: "APOSTU CATALINA", username: "apostucatalina", isAdmin: true },
  { fullName: "CANBEI RAZVAN", username: "canbeirazvan", isAdmin: false },
  { fullName: "CHITICARU FLORIN", username: "chiticaruflorin", isAdmin: false },
  { fullName: "CIOINEA VASILE", username: "cioineavasile", isAdmin: false },
  { fullName: "COSTACHE FLORIN", username: "costacheflorin", isAdmin: true },
  { fullName: "COSTACHE MARIUS", username: "costachemarius", isAdmin: false },
  { fullName: "COSTAN IONEL", username: "costanionel", isAdmin: false },
  { fullName: "FLOREA DANIEL", username: "floreadaniel", isAdmin: false },
  { fullName: "FLOREA GHEORGHE", username: "floreagheorghe", isAdmin: false },
  { fullName: "GHINTUIALA MADALINA", username: "ghintuialamadalina", isAdmin: true },
  { fullName: "HRISCU COSTEL", username: "hriscucostel", isAdmin: false },
  { fullName: "IFRIM CLAUDIU", username: "ifrimclaudiu", isAdmin: false },
  { fullName: "IFRIM REMUS", username: "ifrimremus", isAdmin: false },
  { fullName: "JIMBU COSTEL", username: "jimbucostel", isAdmin: false },
  { fullName: "JIMBU GABRIEL", username: "jimbugabriel", isAdmin: false },
  { fullName: "JIMBU MARIAN", username: "jimbumarian", isAdmin: false },
  { fullName: "MACIUCA BOGDAN", username: "maciucabogdan", isAdmin: false },
  { fullName: "MORARU ION", username: "moraruion", isAdmin: false },
  { fullName: "MUNTEANU ADRIAN", username: "munteanuadrian", isAdmin: false },
  { fullName: "NISTOR BOGDAN", username: "nistorbogdan", isAdmin: false },
  { fullName: "NISTOR RADU", username: "nistorradu", isAdmin: false },
  { fullName: "RADU COSTEL", username: "raducostel", isAdmin: false },
  { fullName: "RADU IOAN", username: "raduioan", isAdmin: false },
  { fullName: "RADU LAURENTIU", username: "radulaurentiu", isAdmin: true },
  { fullName: "RUSU GHEORGHITA", username: "rusugheorghita", isAdmin: false },
  { fullName: "RUSU IONEL", username: "rusuionel", isAdmin: false },
  { fullName: "UNGUREANU MADALIN", username: "unguranumadalin", isAdmin: false },
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

  const handleExportCredentials = () => {
    const exportData = EMPLOYEES.map(emp => ({
      'Nume Complet': emp.fullName,
      'Username': emp.username,
      'Parolă': '123456',
      'Rol': emp.isAdmin ? 'Administrator' : 'Angajat'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credențiale');
    XLSX.writeFile(workbook, `credentiale-angajati-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Export realizat",
      description: "Lista cu credențiale a fost descărcată.",
    });
  };

  const handleResetPasswords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-employee-passwords', { body: {} });
      if (error) throw error;
      
      const messages = [
        `✅ ${data.count || 0} parole resetate la 123456`,
        data.rateLimitUnblocked ? "🔓 Rate limiting deblocat pentru toți angajații" : "",
        "⚠️ Toți angajații trebuie să-și schimbe parola la prima autentificare"
      ].filter(Boolean).join('\n');

      toast({ 
        title: 'Parole resetate cu succes', 
        description: messages,
        duration: 6000
      });
    } catch (e) {
      console.error('Reset passwords error:', e);
      toast({ title: 'Eroare', description: e instanceof Error ? e.message : 'A apărut o eroare', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Import Salariați">
      <div className="p-6">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Import Salariați</CardTitle>
              <CardDescription>
                Importă {EMPLOYEES.length} salariați în sistem. Toți vor primi parola temporară "123456".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Username format:</strong> nume + prenume (ex: ababeiciprian pentru Ababei Ciprian)<br />
                  <strong>Email format:</strong> username@company.local<br />
                  <strong>Parolă temporară:</strong> 123456<br />
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

              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleImport} disabled={loading} className="flex-1 min-w-[200px]">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importă Salariați
                </Button>
                <Button onClick={handleExportCredentials} variant="outline" disabled={loading} className="min-w-[220px]">
                  <Download className="mr-2 h-4 w-4" />
                  Export Username & Parolă
                </Button>
                <Button onClick={handleResetPasswords} variant="destructive" disabled={loading} className="min-w-[260px]">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Resetează parole (123456)
                </Button>
              </div>

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
      </div>
    </AdminLayout>
  );
}