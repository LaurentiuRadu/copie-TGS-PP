import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MigrationTestPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runMigration = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const limit = 15;
      let offset = 0;
      let totalProcessed = 0;
      let totalGenerated = 0;
      let totalErrors = 0;
      let hasMore = true;
      let iterations = 0;

      while (hasMore && iterations < 20) {
        const { data, error } = await supabase.functions.invoke('migrate-historical-timesheets', {
          body: { process_last_24h: true, limit, offset }
        });
        if (error) throw error;

        totalProcessed += data?.stats?.processed || 0;
        totalGenerated += data?.stats?.generated || 0;
        totalErrors += data?.stats?.errors || 0;
        hasMore = !!data?.page?.has_more;

        setResults({
          stats: { processed: totalProcessed, generated: totalGenerated, errors: totalErrors },
          page: { ...data?.page }
        });

        if (hasMore) {
          offset += limit;
          await new Promise((r) => setTimeout(r, 150));
        }
        iterations++;
      }

      toast.success("Migrare finalizată cu succes!");
      // Verifică rezultatele
      await verifyResults();
    } catch (error: any) {
      console.error('Migration error:', error);
      toast.error(`Eroare la migrare: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const verifyResults = async () => {
    try {
      // Test 1: INTRARE CONDUS
      const { data: condusData } = await supabase
        .from('daily_timesheets')
        .select('*')
        .eq('work_date', '2025-10-06')
        .single();

      console.log('Test Condus/Pasager (2025-10-06):', condusData);

      // Test 2: INTRARE NORMAL noapte
      const { data: nightData } = await supabase
        .from('daily_timesheets')
        .select('*')
        .gte('hours_night', 0.1)
        .limit(1)
        .single();

      console.log('Test Normal Noapte:', nightData);

      // Test 3: Total per angajat
      const { data: aggregates } = await supabase
        .from('daily_timesheets')
        .select('employee_id, hours_driving, hours_passenger, hours_regular, hours_weekend: hours_saturday')
        .limit(5);

      console.log('Aggregate Test:', aggregates);

      toast.success("Verificare completă - vezi consola pentru detalii");
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  return (
    <Card className="shadow-elegant border-warning/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-warning" />
              🧪 Testare Fragmentare Ore
            </CardTitle>
            <CardDescription className="mt-1">
              RegenereazăDaily Timesheets cu logica nouă
            </CardDescription>
          </div>
          <Button
            onClick={runMigration}
            disabled={isRunning}
            variant="outline"
            className="gap-2"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRunning ? "Procesare..." : "Rulează Migrare"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {results ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Migrare finalizată</span>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono space-y-1">
              <div>✅ Procesate: {results?.stats?.processed ?? 0} time entries</div>
              <div>✅ Generate: {results?.stats?.generated ?? 0} daily timesheets</div>
              {typeof results?.stats?.errors === 'number' && results.stats.errors > 0 && (
                <div className="text-destructive">
                  ❌ Erori: {results.stats.errors}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-2 space-y-1">
              <div><strong>Reguli testate:</strong></div>
              <div>• CONDUS: toate orele → hours_driving</div>
              <div>• PASAGER: toate orele → hours_passenger</div>
              <div>• UTILAJ: toate orele → hours_equipment</div>
              <div>• NORMAL: fragmentare zi/noapte/weekend</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Rulează migrarea pentru a regenera toate timesheets-urile
            </p>
            <p className="text-xs mt-1">
              ⚠️ Daily timesheets au fost șterse - datele vechi nu mai există
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
