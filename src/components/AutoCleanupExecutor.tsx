import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface CleanupResult {
  success: boolean;
  deleted_entries?: number;
  reprocessing_result?: any;
  error?: string;
}

export const AutoCleanupExecutor = () => {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<CleanupResult | null>(null);

  const executeCleanup = async () => {
    setStatus('running');
    
    try {
      console.log('[AutoCleanup] Starting cleanup for 09.10.2025...');
      
      const { data, error } = await supabase.functions.invoke('cleanup-invalid-entries', {
        body: {
          user_id: '3bb29e9f-d5b3-4501-a2f6-00c262d40ac9', // Canbei Razvan
          start_date: '2025-10-09',
          end_date: '2025-10-09',
          min_duration_minutes: 2,
          dry_run: false
        }
      });

      if (error) {
        console.error('[AutoCleanup] Error:', error);
        setStatus('error');
        setResult({ success: false, error: error.message });
        toast({
          title: "Cleanup eșuat",
          description: error.message,
          variant: "destructive",
          duration: 7000
        });
        return;
      }

      console.log('[AutoCleanup] Success:', data);
      setStatus('success');
      setResult(data);
      
      toast({
        title: "✅ Cleanup completat",
        description: `${data.deleted_entries} intrări șterse. Timesheets recalculat automat.`,
        duration: 5000
      });
      
    } catch (err: any) {
      console.error('[AutoCleanup] Fatal error:', err);
      setStatus('error');
      setResult({ success: false, error: err.message });
      toast({
        title: "Eroare",
        description: err.message,
        variant: "destructive",
        duration: 7000
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'running' && <Loader2 className="h-5 w-5 animate-spin" />}
          {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
          Cleanup Automat Intrări Invalide
        </CardTitle>
        <CardDescription>
          Șterge intrările &lt; 2 minute pentru 09.10.2025 (Canbei Razvan)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <Button onClick={executeCleanup} size="lg" className="w-full">
            🚀 Execută Cleanup Acum
          </Button>
        )}
        
        {status === 'running' && (
          <div className="flex items-center justify-center gap-2 p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Rulează cleanup și reprocessare...</span>
          </div>
        )}
        
        {status === 'success' && result && (
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg space-y-2">
            <div className="font-semibold text-green-700 dark:text-green-300">
              ✅ Cleanup Completat!
            </div>
            <div className="text-sm space-y-1">
              <div>Intrări șterse: <span className="font-mono">{result.deleted_entries}</span></div>
              <div className="text-xs text-muted-foreground mt-2">
                Timesheets-ul pentru 09.10.2025 a fost recalculat automat.
              </div>
            </div>
            <Button 
              onClick={() => setStatus('idle')} 
              variant="outline" 
              size="sm"
              className="mt-2"
            >
              Resetează
            </Button>
          </div>
        )}
        
        {status === 'error' && result && (
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg space-y-2">
            <div className="font-semibold text-red-700 dark:text-red-300">
              ❌ Cleanup Eșuat
            </div>
            <div className="text-sm text-red-600 dark:text-red-400">
              {result.error}
            </div>
            <Button 
              onClick={() => setStatus('idle')} 
              variant="outline" 
              size="sm"
              className="mt-2"
            >
              Încearcă Din Nou
            </Button>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mt-4 border-t pt-4">
          <div className="font-semibold mb-1">Ce face acest cleanup:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Șterge intrările cu durată &lt; 2 minute</li>
            <li>Păstrează intrările valide (&gt;2 minute)</li>
            <li>Invocă automat reprocess-all-timesheets</li>
            <li>Recalculează daily_timesheets pentru ziua specificată</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
