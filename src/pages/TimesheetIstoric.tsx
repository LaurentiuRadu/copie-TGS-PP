import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimesheetHistoryManager } from '@/components/TimesheetHistoryManager';
import { ReprocesareOctombrie } from '@/components/ReprocesareOctombrie';
import { History } from 'lucide-react';

export default function TimesheetIstoric() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 space-y-4">
      <ReprocesareOctombrie />
      
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6" />
            Istoric Aprobări
          </CardTitle>
          <CardDescription>
            Vizualizează și editează pontajele aprobate din ultimele 30 de zile
          </CardDescription>
        </CardHeader>

        <CardContent>
          <TimesheetHistoryManager />
        </CardContent>
      </Card>
    </div>
  );
}
