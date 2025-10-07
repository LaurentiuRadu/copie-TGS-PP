import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SimpleDateRangePicker } from "@/components/ui/simple-date-range-picker";
import { addDays, format } from "date-fns";

interface MigrationStats {
  processed: number;
  generated: number;
  errors: number;
}

export const HistoricalDataMigration = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 9, 6), // Oct 6, 2025
    to: new Date(2025, 9, 7),   // Oct 7, 2025
  });

  const runMigration = async () => {
    setIsRunning(true);
    setStats(null);
    
    try {
      console.log('[Migration] Starting for date range:', dateRange);
      
      const { data, error } = await supabase.functions.invoke('migrate-historical-timesheets', {
        body: {
          process_last_24h: false,
          start_date: format(dateRange.from, 'yyyy-MM-dd'),
          end_date: format(dateRange.to, 'yyyy-MM-dd'),
          limit: 1000
        }
      });

      if (error) {
        console.error('[Migration] Error:', error);
        toast.error(`Eroare la migrare: ${error.message}`);
        return;
      }

      console.log('[Migration] Success:', data);
      
      setStats({
        processed: data.entriesProcessed || 0,
        generated: data.timesheetsGenerated || 0,
        errors: data.errors?.length || 0
      });

      if (data.errors && data.errors.length > 0) {
        console.warn('[Migration] Validation errors:', data.errors);
        toast.warning(`Migrare completă cu ${data.errors.length} avertismente de validare`, {
          duration: 5000
        });
      } else {
        toast.success('Migrare completă! Toate datele au fost procesate.', {
          duration: 5000
        });
      }
      
    } catch (error: any) {
      console.error('[Migration] Exception:', error);
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-elegant border-warning/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-warning" />
                <CardTitle>Migrare Date Istorice</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
            </div>
            <CardDescription>
              Reprocessează pontajele existente pentru a genera daily_timesheets corecte
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Selectează perioada:</label>
          <SimpleDateRangePicker
            selected={dateRange}
            onSelect={(range) => {
              if (range?.from) {
                setDateRange({ 
                  from: range.from, 
                  to: range.to || range.from 
                });
              }
            }}
          />
        </div>

        <Button
          onClick={runMigration}
          disabled={isRunning}
          className="w-full"
          variant="default"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesare în curs...
            </>
          ) : (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Rulează Migrare
            </>
          )}
        </Button>

        {stats && (
          <div className="mt-4 space-y-2 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Rezultate Migrare
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pontaje procesate:</span>
                <span className="font-medium">{stats.processed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timesheets generate:</span>
                <span className="font-medium text-success">{stats.generated}</span>
              </div>
              {stats.errors > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avertismente:</span>
                  <span className="font-medium text-warning flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {stats.errors}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ℹ️ Verifică logurile pentru detalii despre eventualele avertismente
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 mt-4 p-3 bg-info/10 rounded-lg border border-info/20">
          <p className="font-medium text-info">📋 Ce face această funcție:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Scanează toate pontajele din perioada selectată</li>
            <li>Generează daily_timesheets cu segmentare corectă</li>
            <li>Aplică regulile pentru ore noapte, weekend, sărbători</li>
            <li>Detectează automat tipul de tură (condus, pasager, etc.)</li>
          </ul>
        </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
