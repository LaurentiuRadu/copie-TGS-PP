import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamTimeApprovalManager } from '@/components/TeamTimeApprovalManager';
import { ClipboardCheck } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';

export default function TimesheetVerificare() {
  const [selectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Verificare Pontaje
          </CardTitle>
          <CardDescription>
            Aprobă, editează sau respinge pontajele angajaților
          </CardDescription>
        </CardHeader>

        <CardContent>
          <TeamTimeApprovalManager
            selectedWeek={selectedWeek}
            availableTeams={new Set(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
