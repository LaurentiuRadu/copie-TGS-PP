import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Database, Download, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

export const FullDatabaseExportDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-full-database-export');

      if (error) throw error;

      // Format JSON cu indent pentru copy-paste ușor
      const formatted = JSON.stringify(data, null, 2);
      setExportData(formatted);

      toast({
        title: '✅ Export complet',
        description: `${Object.keys(data.database).length} tabele exportate`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: '❌ Eroare export',
        description: error.message || 'Nu s-a putut exporta baza de date',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportData);
      setCopied(true);
      toast({
        title: '📋 Copiat!',
        description: 'JSON-ul a fost copiat în clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: '❌ Eroare',
        description: 'Nu s-a putut copia în clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: '💾 Descărcat!',
      description: 'Fișierul JSON a fost descărcat',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          Export DB Complet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Bază de Date Completă</DialogTitle>
          <DialogDescription>
            Exportă toate datele din 34 tabele pentru transfer către Bolt
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {!exportData ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Database className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Apasă butonul pentru a exporta întreaga bază de date
              </p>
              <Button onClick={handleExport} disabled={loading} size="lg">
                {loading ? 'Se exportă...' : '📦 Exportă Acum'}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiat!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiază în Clipboard
                    </>
                  )}
                </Button>
                <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Descarcă .json
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm" disabled={loading}>
                  🔄 Re-exportă
                </Button>
              </div>

              <div className="flex-1 min-h-0 relative">
                <Textarea
                  value={exportData}
                  readOnly
                  className="font-mono text-xs h-full resize-none"
                  placeholder="JSON export va apărea aici..."
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                  {(exportData.length / 1024).toFixed(0)} KB
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
