import { useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, Database, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function BackupRestore() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      console.log('🗑️ Starting complete app data clear...');
      
      // 1. Clear ALL browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ All caches cleared');
      }
      
      // 2. Clear localStorage
      localStorage.clear();
      console.log('✅ localStorage cleared');
      
      // 3. Clear sessionStorage
      sessionStorage.clear();
      console.log('✅ sessionStorage cleared');
      
      // 4. Unregister ALL service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('✅ All service workers unregistered');
      }
      
      // 5. Clear IndexedDB (if used by any libraries)
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map(db => 
              new Promise((resolve, reject) => {
                if (db.name) {
                  const req = indexedDB.deleteDatabase(db.name);
                  req.onsuccess = () => resolve(true);
                  req.onerror = () => reject(req.error);
                }
              })
            )
          );
          console.log('✅ IndexedDB cleared');
        } catch (err) {
          console.warn('⚠️ Could not clear IndexedDB:', err);
        }
      }
      
      toast({
        title: "✅ Toate datele șterse",
        description: 'Pagina se va reîncărca pentru a aplica modificările...',
      });
      
      // 6. Hard reload after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error clearing app data:', error);
      toast({
        title: "❌ Eroare",
        description: 'Eroare la ștergerea datelor aplicației',
        variant: "destructive",
      });
      setIsClearing(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Export date din toate tabelele principale
      const tables = [
        'profiles',
        'user_roles',
        'time_entries',
        'time_entry_segments',
        'weekly_schedules',
        'vacation_requests',
        'work_locations',
        'holidays',
        'work_hour_rules',
        'user_consents',
        'face_verification_logs',
        'security_alerts',
        'active_sessions',
        'user_password_tracking',
        'gdpr_requests',
        'schedule_notifications'
      ];

      const backup: Record<string, any> = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: {}
      };

      for (const table of tables) {
        const { data, error } = await supabase.from(table as any).select('*');
        
        if (error) {
          console.error(`Error exporting ${table}:`, error);
          continue;
        }
        
        backup.tables[table] = data;
      }

      // Creează și downloadează fișierul JSON
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timetrack-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "✅ Backup creat cu succes",
        description: "Datele au fost exportate în format JSON.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "❌ Eroare la export",
        description: "Nu s-au putut exporta datele.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.tables) {
        throw new Error('Format invalid de backup');
      }

      let successCount = 0;
      let errorCount = 0;

      // Import date în tabele
      for (const [tableName, tableData] of Object.entries(backup.tables)) {
        if (!Array.isArray(tableData) || (tableData as any[]).length === 0) continue;

        const { error } = await supabase
          .from(tableName as any)
          .upsert(tableData as any[], { onConflict: 'id' });

        if (error) {
          console.error(`Error importing ${tableName}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      toast({
        title: successCount > 0 ? "✅ Restore finalizat" : "⚠️ Restore cu erori",
        description: `${successCount} tabele importate cu succes. ${errorCount > 0 ? `${errorCount} erori.` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "❌ Eroare la import",
        description: "Nu s-au putut importa datele. Verifică fișierul de backup.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <AdminLayout title="Backup & Restore">
      <div className="container max-w-4xl py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Backup & Restore</h1>
          <p className="text-muted-foreground">
            Gestionează backup-urile datelor aplicației
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenție</AlertTitle>
          <AlertDescription>
            Backup-ul conține toate datele din baza de date. Restore-ul va suprascrie datele existente.
            Recomandăm să creezi un backup înainte de a face restore.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="backup" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="backup">Backup (Export)</TabsTrigger>
            <TabsTrigger value="restore">Restore (Import)</TabsTrigger>
            <TabsTrigger value="maintenance">Mentenanță</TabsTrigger>
          </TabsList>

          <TabsContent value="backup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Creează Backup
                </CardTitle>
                <CardDescription>
                  Exportă toate datele din baza de date într-un fișier JSON
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Ce include backup-ul:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Profiluri utilizatori și roluri</li>
                    <li>Pontaje și segmente de timp</li>
                    <li>Programări săptămânale</li>
                    <li>Cereri de concediu</li>
                    <li>Locații de lucru și sărbători</li>
                    <li>Reguli ore de lucru</li>
                    <li>Log-uri și consimțăminte GDPR</li>
                  </ul>
                </div>

                <Button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Se exportă..." : "Descarcă Backup"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="restore" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Restore Backup
                </CardTitle>
                <CardDescription>
                  Importă datele dintr-un fișier de backup JSON
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Avertisment!</AlertTitle>
                  <AlertDescription>
                    Restore-ul va suprascrie datele existente pentru înregistrările cu același ID.
                    Această acțiune nu poate fi anulată!
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <h3 className="font-semibold">Pași pentru restore:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Creează un backup curent (recomandare)</li>
                    <li>Selectează fișierul de backup JSON</li>
                    <li>Confirmă acțiunea</li>
                    <li>Așteaptă finalizarea importului</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <label htmlFor="backup-file">
                    <Button
                      variant="outline"
                      className="w-full"
                      size="lg"
                      disabled={isImporting}
                      asChild
                    >
                      <span>
                        <Database className="mr-2 h-4 w-4" />
                        {isImporting ? "Se importă..." : "Selectează Fișier Backup"}
                      </span>
                    </Button>
                  </label>
                  <input
                    id="backup-file"
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                    disabled={isImporting}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Format acceptat: JSON (.json)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  Ștergere Completă Date Aplicație
                </CardTitle>
                <CardDescription>
                  Șterge toate cache-urile, service workers și datele locale pentru a rezolva probleme de inițializare
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>ATENȚIE</AlertTitle>
                  <AlertDescription>
                    Această acțiune va șterge:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Toate cache-urile browser (inclusiv service workers)</li>
                      <li>localStorage și sessionStorage</li>
                      <li>IndexedDB</li>
                      <li>Toate sesiunile active</li>
                    </ul>
                    <p className="mt-2">Veți fi delogat automat și aplicația se va reîncărca.</p>
                    <p className="font-bold mt-2">DATELE DIN BAZA DE DATE NU VOR FI AFECTATE!</p>
                  </AlertDescription>
                </Alert>

                <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">Când să folosiți această funcție:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Erori de tip "Invalid hook call" sau "dispatcher is null"</li>
                    <li>• Aplicația nu se încarcă corect după update</li>
                    <li>• Comportament inconsistent al PWA</li>
                    <li>• Service Worker blocat sau corupt</li>
                    <li>• Cache-uri vechi care nu se invalidează</li>
                  </ul>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      disabled={isClearing}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isClearing ? "Se șterge..." : "Clear All App Data"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmă ștergerea completă?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Această acțiune va șterge toate cache-urile și datele locale ale aplicației.
                        Veți fi delogat și aplicația se va reîncărca complet.
                        <br /><br />
                        <strong>Datele din baza de date NU vor fi afectate.</strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anulează</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAllData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Da, șterge tot
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
