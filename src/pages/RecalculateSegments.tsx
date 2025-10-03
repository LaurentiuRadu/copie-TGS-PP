import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layouts/AdminLayout';

export default function RecalculateSegments() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const recalculateAllSegments = async () => {
    setIsProcessing(true);
    setResults(null);
    
    try {
      const { data: entries, error: fetchError } = await supabase
        .from('time_entries')
        .select('id, clock_in_time, clock_out_time')
        .not('clock_out_time', 'is', null)
        .order('clock_in_time', { ascending: true });

      if (fetchError) throw fetchError;
      
      if (!entries || entries.length === 0) {
        toast.info('Nu există pontaje de procesat');
        setIsProcessing(false);
        return;
      }

      const processResults = {
        total: entries.length,
        processed: 0,
        success: [] as string[],
        errors: [] as any[]
      };

      setProgress({ current: 0, total: entries.length });

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setProgress({ current: i + 1, total: entries.length });

        try {
          console.log(`Processing entry ${i + 1}/${entries.length}: ${entry.id}`);

          const { error: deleteError } = await supabase
            .from('time_entry_segments')
            .delete()
            .eq('time_entry_id', entry.id);

          if (deleteError) {
            console.error('Delete error:', deleteError);
            throw deleteError;
          }

          const { data: calcData, error: calcError } = await supabase.functions.invoke(
            'calculate-time-segments',
            {
              body: {
                time_entry_id: entry.id,
                clock_in_time: entry.clock_in_time,
                clock_out_time: entry.clock_out_time
              }
            }
          );

          if (calcError) {
            console.error('Calculate error:', calcError);
            throw calcError;
          }

          console.log('✓ Success:', entry.id);
          processResults.success.push(entry.id);
          processResults.processed++;

        } catch (error: any) {
          console.error('✗ Error processing entry:', entry.id, error);
          processResults.errors.push({
            entry_id: entry.id,
            error: error.message || 'Unknown error'
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setResults(processResults);
      
      if (processResults.errors.length === 0) {
        toast.success(`Toate ${processResults.processed} pontaje au fost procesate cu succes!`);
      } else {
        toast.warning(`${processResults.processed} procesate, ${processResults.errors.length} erori`);
      }

    } catch (error: any) {
      console.error('Fatal error:', error);
      toast.error('Eroare critică: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout title="Recalculare Segments">
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Recalculare Segments Pontaje
              </CardTitle>
              <CardDescription>
                Recalculează toate segments-urile pentru pontajele complete.
                Acest proces va șterge și recrea toate segments-urile existente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={recalculateAllSegments}
                disabled={isProcessing}
                size="lg"
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Procesare... {progress.current}/{progress.total}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Recalculează Toate Segments-urile
                  </>
                )}
              </Button>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Procesare: {progress.current} / {progress.total}
                  </p>
                </div>
              )}

              {results && (
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Rezultate Procesare</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{results.total}</div>
                        <div className="text-sm text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                          <CheckCircle className="h-5 w-5" />
                          {results.success.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Succes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                          <XCircle className="h-5 w-5" />
                          {results.errors.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Erori</div>
                      </div>
                    </div>

                    {results.errors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Erori Detaliate:</h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {results.errors.map((err: any, idx: number) => (
                            <div key={idx} className="text-xs bg-destructive/10 p-2 rounded">
                              <span className="font-mono">{err.entry_id}</span>: {err.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}