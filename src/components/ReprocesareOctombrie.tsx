import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

export function ReprocesareOctombrie() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleReprocess = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
        body: {
          mode: 'date_range',
          start_date: '2025-10-13',
          end_date: '2025-10-15',
          batch_size: 100
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success(`✅ Reprocesare completă: ${data.total_processed} intrări procesate`, {
        description: `Success: ${data.success_count} | Failed: ${data.failed_count}`
      });
    } catch (error: any) {
      console.error('Reprocess error:', error);
      toast.error('Eroare la reprocesare', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 bg-warning/10 border-warning">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <RefreshCw className="h-5 w-5" />
        Reprocesare Timezone Fix (13-15 Octombrie)
      </h3>
      
      <p className="text-sm text-muted-foreground mb-4">
        Acest buton va reprocessa toate pontajele din perioada 13-15 octombrie 2025 
        pentru a corecta timezone-urile greșite (offset de 3 ore).
      </p>

      <Button 
        onClick={handleReprocess} 
        disabled={isProcessing}
        variant="default"
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Reprocesare în curs...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reprocesează Pontaje 13-15 Oct
          </>
        )}
      </Button>

      {result && (
        <div className="mt-4 p-4 bg-background rounded-lg border">
          <h4 className="font-semibold mb-2">Rezultate:</h4>
          <div className="text-sm space-y-1">
            <p>✅ Total procesate: <strong>{result.total_processed}</strong></p>
            <p>✅ Succese: <strong className="text-green-600">{result.success_count}</strong></p>
            <p>❌ Eșecuri: <strong className="text-red-600">{result.failed_count}</strong></p>
            {result.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-600">Vezi erori ({result.errors.length})</summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(result.errors, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
