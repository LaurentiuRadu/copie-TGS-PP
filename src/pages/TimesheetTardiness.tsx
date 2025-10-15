import { TardinessReportsManager } from '@/components/TardinessReportsManager';
import { AlertTriangle } from 'lucide-react';

export default function TimesheetTardiness() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Rapoarte Întârzieri</h1>
          </div>
        </div>

        <TardinessReportsManager />
      </div>
    </div>
  );
}
