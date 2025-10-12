import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { RefreshCw, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

export function ManualReprocessButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleReprocess = async () => {
    setIsProcessing(true);
    setResults(null);
    
    try {
      toast.info("PAS 3: Reprocessare în curs...");

      // Fetch toate entries din 12 octombrie
      const { data: entries, error: fetchError } = await supabase
        .from('time_entries')
        .select('id, clock_in_time, clock_out_time, notes')
        .eq('user_id', '444cfecc-fb2d-46f3-8050-0c762b308850')
        .gte('clock_in_time', '2025-10-12T00:00:00Z')
        .lte('clock_in_time', '2025-10-12T23:59:59Z')
        .not('clock_out_time', 'is', null)
        .order('clock_in_time');

      if (fetchError) throw fetchError;

      toast.info(`Găsite ${entries?.length || 0} entries. Reprocessare...`);

      // Procesează ultimul entry (trigger agregare pentru toate)
      if (entries && entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        
        const { data, error } = await supabase.functions.invoke('calculate-time-segments', {
          body: {
            user_id: '444cfecc-fb2d-46f3-8050-0c762b308850',
            time_entry_id: lastEntry.id,
            clock_in_time: lastEntry.clock_in_time,
            clock_out_time: lastEntry.clock_out_time,
            notes: lastEntry.notes,
            isIntermediateCalculation: false
          }
        });

        if (error) throw error;

        toast.success("PAS 3 COMPLETAT: Reprocessare finalizată!");

        // PAS 4: Verificare
        const { data: segments } = await supabase
          .from('time_entry_segments')
          .select('*')
          .in('time_entry_id', entries.map(e => e.id))
          .order('start_time');

        const { data: timesheets } = await supabase
          .from('daily_timesheets')
          .select('*')
          .eq('employee_id', '444cfecc-fb2d-46f3-8050-0c762b308850')
          .eq('work_date', '2025-10-12');

        setResults({
          entriesCount: entries.length,
          segmentsCount: segments?.length || 0,
          timesheetsCount: timesheets?.length || 0,
          segments: segments,
          timesheets: timesheets
        });

        toast.success(`✅ PAS 4-5: Verificare completată!
        - ${entries.length} entries
        - ${segments?.length || 0} segmente salvate
        - ${timesheets?.length || 0} daily_timesheets`);
      }
    } catch (error: any) {
      console.error('Reprocess error:', error);
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>🧪 Test Reprocessare Completă</CardTitle>
        <CardDescription>
          PAS 3-5: Reprocessare manuală + Verificare finală
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleReprocess} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Reprocessare în curs...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Rulează PAS 3-5
            </>
          )}
        </Button>

        {results && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                {showDetails ? "Ascunde" : "Arată"} Rezultate Detaliate
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <h3 className="font-semibold">📊 Sumar:</h3>
                <ul className="text-sm space-y-1">
                  <li>✅ {results.entriesCount} time entries procesate</li>
                  <li>✅ {results.segmentsCount} segmente salvate</li>
                  <li>✅ {results.timesheetsCount} daily_timesheets generate</li>
                </ul>
              </div>

              {results.timesheets && results.timesheets.length > 0 && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <h3 className="font-semibold">📅 Daily Timesheet (2025-10-12):</h3>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(results.timesheets[0], null, 2)}
                  </pre>
                </div>
              )}

              {results.segments && results.segments.length > 0 && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <h3 className="font-semibold">🔧 Segmente ({results.segments.length}):</h3>
                  <div className="max-h-64 overflow-auto">
                    {results.segments.map((seg: any, idx: number) => (
                      <div key={idx} className="text-xs border-b pb-1 mb-1">
                        <span className="font-mono">{seg.segment_type}</span>: {seg.hours_decimal}h
                        <span className="text-muted-foreground ml-2">
                          ({new Date(seg.start_time).toLocaleTimeString('ro-RO')} - {new Date(seg.end_time).toLocaleTimeString('ro-RO')})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
