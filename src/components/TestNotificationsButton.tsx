import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TestNotificationsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleTestNotifications = async () => {
    setIsLoading(true);
    setShowDialog(false);
    
    try {
      toast.info('🧪 Se trimite mesajul de test...', {
        description: 'Simulăm trimiterea notificărilor către toți utilizatorii.',
      });

      const { data, error } = await supabase.functions.invoke('test-schedule-notifications');

      if (error) {
        throw error;
      }

      console.log('[Test Notifications] Results:', data);
      setResults(data.details);

      if (data.success) {
        toast.success(data.message, {
          description: `📊 Total: ${data.details.total} | ✅ Trimise: ${data.details.sent} | ❌ Eșuate: ${data.details.failed}`,
          duration: 10000,
        });

        // Show detailed results in console
        console.table(data.details.users);
      } else {
        toast.error('Eroare la trimiterea notificărilor', {
          description: data.message,
        });
      }

    } catch (error: any) {
      console.error('[Test Notifications] Error:', error);
      toast.error('Eroare la testarea notificărilor', {
        description: error.message || 'A apărut o eroare necunoscută.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        disabled={isLoading}
        variant="outline"
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Se trimite...
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            Test Notificări Programări
          </>
        )}
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🧪 Test Notificări Săptămânale</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Această funcție va simula trimiterea de notificări push către toți utilizatorii
                care au subscripții active de notificări.
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Notă: Aceasta este o simulare de test. Notificările nu vor fi trimise real
                către dispozitivele utilizatorilor, dar vei vedea rezultatele în consolă.
              </p>
              <div className="bg-muted p-3 rounded-md text-sm mt-3">
                <p className="font-semibold mb-1">Notificarea va include:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Numele complet al utilizatorului</li>
                  <li>Programarea săptămânală (zilele programate)</li>
                  <li>Detalii despre ture (zi/noapte, locație)</li>
                  <li>Numărul total de zile programate</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleTestNotifications}>
              Trimite Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {results && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">📊 Rezultate Test:</h3>
          <div className="space-y-1 text-sm">
            <p>Total utilizatori: {results.total}</p>
            <p className="text-green-600">✅ Trimise cu succes: {results.sent}</p>
            <p className="text-red-600">❌ Eșuate: {results.failed}</p>
            <p className="text-muted-foreground">Săptămână: {results.weekStart}</p>
          </div>
          {results.errors.length > 0 && (
            <div className="mt-2 p-2 bg-destructive/10 rounded">
              <p className="font-semibold text-sm text-destructive mb-1">Erori:</p>
              <ul className="text-xs space-y-1">
                {results.errors.map((error: string, i: number) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
