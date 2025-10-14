import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TardinessReportsManager } from '@/components/TardinessReportsManager';
import { AlertTriangle } from 'lucide-react';

export default function TimesheetTardiness() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Rapoarte Întârzieri
          </CardTitle>
          <CardDescription>
            Vizualizează și gestionează rapoartele de întârzieri ale angajaților
          </CardDescription>
        </CardHeader>

        <CardContent>
          <TardinessReportsManager />
        </CardContent>
      </Card>
    </div>
  );
}
