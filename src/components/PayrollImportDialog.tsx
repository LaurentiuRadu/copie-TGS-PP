import { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  success: boolean;
  imported_rows: number;
  grouped_entries: number;
  employees_count: number;
  employees_list: string[];
  date_range: {
    start: string;
    end: string;
  };
  hours_by_type: {
    hours_regular: number;
    hours_night: number;
    hours_saturday: number;
    hours_sunday: number;
    hours_holiday: number;
    hours_passenger: number;
    hours_driving: number;
    hours_equipment: number;
    hours_leave: number;
    hours_medical_leave: number;
  };
  deleted_entries: {
    time_entries: number;
    daily_timesheets: number;
  };
  errors: string[];
  warnings: string[];
  error?: string;
}

interface PayrollImportDialogProps {
  onImportComplete?: () => void;
}

export function PayrollImportDialog({ onImportComplete }: PayrollImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    // Read and preview first 10 lines
    const text = await selectedFile.text();
    const lines = text.split('\n').slice(0, 10);
    setPreview(lines);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    
    try {
      console.log('[PayrollImport] Starting import...');

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('import-payroll-hours', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('[PayrollImport] Import completed:', data);

      if (data.success) {
        setResult(data);
        toast.success(`Import reușit! ${data.grouped_entries} zile de muncă importate.`);
        
        // Call callback to refresh data
        if (onImportComplete) {
          setTimeout(() => {
            onImportComplete();
          }, 1000);
        }
      } else {
        throw new Error(data.error || 'Import failed');
      }

    } catch (error: any) {
      console.error('[PayrollImport] Error:', error);
      toast.error(`Eroare la import: ${error.message}`);
      setResult({
        success: false,
        error: error.message,
        imported_rows: 0,
        grouped_entries: 0,
        employees_count: 0,
        employees_list: [],
        date_range: { start: '', end: '' },
        hours_by_type: {
          hours_regular: 0,
          hours_night: 0,
          hours_saturday: 0,
          hours_sunday: 0,
          hours_holiday: 0,
          hours_passenger: 0,
          hours_driving: 0,
          hours_equipment: 0,
          hours_leave: 0,
          hours_medical_leave: 0,
        },
        deleted_entries: { time_entries: 0, daily_timesheets: 0 },
        errors: [],
        warnings: [],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setPreview([]);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importă Ore Payroll
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Ore din Payroll (CSV)</DialogTitle>
          <DialogDescription>
            Încarcă fișier CSV cu ore lucrate (format: Angajat;Data;Tip Ore;Ore Lucrate)
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Warning Section */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>ATENȚIE:</strong> Acest import va:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Șterge toate pontajele existente din perioada importată</li>
                  <li>Înlocui datele existente în daily_timesheets pentru acele zile</li>
                  <li>Nu poate fi anulat după confirmare</li>
                </ul>
                <p className="mt-2 font-semibold">Asigură-te că CSV-ul este corect înainte de import!</p>
              </AlertDescription>
            </Alert>

            {/* File Input */}
            <div className="space-y-2">
              <label htmlFor="csv-file" className="text-sm font-medium">
                Selectează fișier CSV
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Preview (primele 10 rânduri)</h3>
                  </div>
                  <div className="bg-muted rounded-md p-3 overflow-x-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {preview.join('\n')}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Anulează
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Confirmă Import
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Results Section
          <div className="space-y-4">
            {result.success ? (
              <>
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <strong className="text-green-800">Import reușit!</strong>
                  </AlertDescription>
                </Alert>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-primary">
                        {result.grouped_entries}
                      </div>
                      <div className="text-xs text-muted-foreground">Zile importate</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-primary">
                        {result.employees_count}
                      </div>
                      <div className="text-xs text-muted-foreground">Angajați</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-primary">
                        {result.deleted_entries.time_entries}
                      </div>
                      <div className="text-xs text-muted-foreground">Pontaje șterse</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-primary">
                        {Object.values(result.hours_by_type).reduce((sum, h) => sum + h, 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Ore totale</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Date Range */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-medium mb-2">Perioadă importată</h3>
                    <p className="text-sm text-muted-foreground">
                      {result.date_range.start} → {result.date_range.end}
                    </p>
                  </CardContent>
                </Card>

                {/* Hours by Type */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-medium mb-3">Ore pe tipuri</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {result.hours_by_type.hours_regular > 0 && (
                        <div>Ore Zi: <strong>{result.hours_by_type.hours_regular.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_night > 0 && (
                        <div>Ore Noapte: <strong>{result.hours_by_type.hours_night.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_saturday > 0 && (
                        <div>Ore Sâmbătă: <strong>{result.hours_by_type.hours_saturday.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_sunday > 0 && (
                        <div>Ore Duminică: <strong>{result.hours_by_type.hours_sunday.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_holiday > 0 && (
                        <div>Ore Sărbători: <strong>{result.hours_by_type.hours_holiday.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_driving > 0 && (
                        <div>Ore Condus: <strong>{result.hours_by_type.hours_driving.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_passenger > 0 && (
                        <div>Ore Pasager: <strong>{result.hours_by_type.hours_passenger.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_equipment > 0 && (
                        <div>Ore Utilaj: <strong>{result.hours_by_type.hours_equipment.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_leave > 0 && (
                        <div>Ore CO: <strong>{result.hours_by_type.hours_leave.toFixed(1)}</strong></div>
                      )}
                      {result.hours_by_type.hours_medical_leave > 0 && (
                        <div>Ore CM: <strong>{result.hours_by_type.hours_medical_leave.toFixed(1)}</strong></div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Avertismente ({result.warnings.length}):</strong>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        {result.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Errors */}
                {result.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Erori ({result.errors.length}):</strong>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        {result.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Import eșuat:</strong> {result.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleClose}>
                Închide
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
