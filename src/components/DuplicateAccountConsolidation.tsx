import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DuplicatePair {
  admin: string;
  employee: string;
  count: number;
}

export function DuplicateAccountConsolidation() {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  const duplicatePairs: DuplicatePair[] = [
    { admin: 'laurentiuradu', employee: 'radulaurentiu', count: 56 },
    { admin: 'catalinaapostu', employee: 'apostucatalina', count: 8 },
    { admin: 'florincostache', employee: 'costacheflorin', count: 13 },
    { admin: 'madalinaghintuiala', employee: 'ghintuialamadalina', count: 1 }
  ];

  const handleRunMigration = async () => {
    setIsLoading(true);
    setProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const { data, error } = await supabase.functions.invoke('consolidate-duplicate-accounts', {
        body: { dryRun: false }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setMigrationResult(data);
      toast.success('Consolidare completată cu succes!');
    } catch (error: any) {
      console.error('[Consolidation] Error:', error);
      toast.error('Eroare la consolidare: ' + error.message);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setConfirmChecked(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-600" />
          Consolidare Conturi Duplicate
          <Badge variant="destructive">4 perechi identificate</Badge>
        </CardTitle>
        <CardDescription>
          Migrează datele din conturile duplicate de angajați în conturile de admin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista Perechilor */}
        <div className="space-y-2">
          {duplicatePairs.map((pair, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <span className="font-semibold">{pair.admin}</span>
                <span className="text-muted-foreground"> ← </span>
                <span className="text-destructive">{pair.employee}</span>
              </div>
              <Badge variant="secondary">{pair.count} pontaje</Badge>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-orange-900 dark:text-orange-100">Atenție!</p>
            <p className="text-orange-800 dark:text-orange-200">
              Această operație va:
            </p>
            <ul className="list-disc ml-4 mt-1 text-orange-800 dark:text-orange-200">
              <li>Migra toate datele din conturile de angajat în conturile de admin</li>
              <li>Șterge definitiv conturile duplicate de angajat</li>
              <li>Nu poate fi anulată după execuție</li>
            </ul>
          </div>
        </div>

        {/* Progress Bar */}
        {isLoading && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Consolidare în curs... {progress}%
            </p>
          </div>
        )}

        {/* Rezultat Migrare */}
        {migrationResult && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900 dark:text-green-100">
                Consolidare Completată!
              </span>
            </div>
            <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <p><strong>Total perechi procesate:</strong> {migrationResult.totalPairs || 0}</p>
              <p><strong>Succese:</strong> {migrationResult.successful || 0}</p>
              <p><strong>Eșecuri:</strong> {migrationResult.failed || 0}</p>
              {migrationResult.results && (
                <details className="mt-2">
                  <summary className="cursor-pointer hover:underline">
                    Vezi detalii complete
                  </summary>
                  <pre className="text-xs mt-2 p-2 bg-green-100 dark:bg-green-900 rounded overflow-auto max-h-64">
                    {JSON.stringify(migrationResult, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Buton Consolidare */}
        <Button 
          onClick={() => setShowConfirmDialog(true)}
          disabled={isLoading || !!migrationResult}
          className="w-full"
          variant="destructive"
        >
          {migrationResult ? '✅ Consolidare Completată' : '🔄 Consolidează Conturi Duplicate'}
        </Button>

        {/* Dialog Confirmare */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Confirmare Consolidare Conturi
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  Ești pe cale să consolidezi <strong>4 perechi de conturi duplicate</strong>:
                </p>
                <div className="space-y-1 text-sm">
                  {duplicatePairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>
                        <strong>{pair.admin}</strong> ← <span className="text-destructive">{pair.employee}</span>
                      </span>
                      <Badge variant="secondary">{pair.count} pontaje</Badge>
                    </div>
                  ))}
                </div>
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 p-3 rounded">
                  <p className="text-sm text-orange-900 dark:text-orange-100 font-semibold">
                    ⚠️ Această operație:
                  </p>
                  <ul className="text-sm text-orange-800 dark:text-orange-200 list-disc ml-4 mt-1">
                    <li>NU poate fi anulată</li>
                    <li>Va șterge conturile de angajat definitiv</li>
                    <li>Va crea un log de audit pentru fiecare migrare</li>
                  </ul>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="confirm-migration" 
                    checked={confirmChecked}
                    onCheckedChange={(checked) => setConfirmChecked(checked === true)}
                  />
                  <label 
                    htmlFor="confirm-migration" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Înțeleg că această acțiune nu poate fi anulată
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setConfirmChecked(false);
                setShowConfirmDialog(false);
              }}>
                Anulează
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRunMigration}
                disabled={!confirmChecked || isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? 'Se consolidează...' : 'Da, Consolidează Conturile'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
