import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function TimeEntryReprocessButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'missing_segments' | 'needs_reprocessing' | 'current_month' | 'specific_date'>('missing_segments');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [open, setOpen] = useState(false);

  const handleReprocess = async () => {
    setIsProcessing(true);
    
    try {
      console.log(`[Reprocess] Starting with mode: ${mode}`);
      
      let body: any;
      
      if (mode === 'current_month') {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        body = { mode: 'date_range', start_date: startDate, end_date: endDate, batch_size: 100 };
      } else if (mode === 'specific_date') {
        if (!selectedDate) {
          toast.error('Te rog selectează o dată');
          setIsProcessing(false);
          return;
        }
        body = { mode: 'date_range', start_date: selectedDate, end_date: selectedDate, batch_size: 100 };
      } else {
        body = { mode, batch_size: 100 };
      }
      
      const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
        body
      });

      if (error) throw error;

      const results = data as { total: number; success: number; failed: number; batches?: number; errors: string[] };
      
      console.log('[Reprocess] Results:', results);
      
      if (results.success > 0) {
        toast.success(`Reprocesare completă: ${results.success}/${results.total} pontaje procesate cu succes`, {
          description: results.batches 
            ? `Procesate în ${results.batches} batch-uri${results.failed > 0 ? ` (${results.failed} eșuate)` : ''}`
            : results.failed > 0 
              ? `${results.failed} pontaje au eșuat`
              : undefined,
          duration: 5000,
        });
      } else if (results.total === 0) {
        toast.info('Nu există pontaje de reprocesat');
      } else {
        toast.error(`Reprocesarea a eșuat pentru toate ${results.failed} pontaje`, {
          description: 'Verifică logurile pentru detalii',
          duration: 5000,
        });
      }

      setOpen(false);
      
    } catch (error: any) {
      console.error('[Reprocess] Error:', error);
      toast.error('Eroare la reprocesare', {
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reprocesare Pontaje
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprocesare Pontaje</DialogTitle>
          <DialogDescription>
            Selectează modul de reprocesare pentru pontajele care nu au fost procesate automat
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="missing_segments" id="missing_segments" />
              <Label htmlFor="missing_segments" className="font-normal cursor-pointer">
                <div>
                  <div className="font-medium">Pontaje fără segmente</div>
                  <div className="text-sm text-muted-foreground">
                    Procesează pontajele finalizate care nu au segmente orare generate
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="needs_reprocessing" id="needs_reprocessing" />
              <Label htmlFor="needs_reprocessing" className="font-normal cursor-pointer">
                <div>
                  <div className="font-medium">Pontaje marcate pentru reprocesare</div>
                  <div className="text-sm text-muted-foreground">
                    Procesează doar pontajele care au eșuat automat
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="current_month" id="current_month" />
              <Label htmlFor="current_month" className="font-normal cursor-pointer">
                <div>
                  <div className="font-medium">Reprocesează luna curentă</div>
                  <div className="text-sm text-muted-foreground">
                    Recalculează toate pontajele din luna vizibilă (recomandabil pentru corecții)
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="specific_date" id="specific_date" />
              <Label htmlFor="specific_date" className="font-normal cursor-pointer">
                <div>
                  <div className="font-medium">Reprocesează o dată specifică</div>
                  <div className="text-sm text-muted-foreground">
                    Recalculează toate pontajele dintr-o zi anume
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
          
          {mode === 'specific_date' && (
            <div className="mt-4">
              <Label htmlFor="date" className="text-sm font-medium">Selectează data</Label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                defaultValue="2025-10-12"
                className="w-full mt-2 px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
          )}
          
          <div className="pt-4">
            <Button 
              onClick={handleReprocess} 
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesare...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reprocesează toate pontajele
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}