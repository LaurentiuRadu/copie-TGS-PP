import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { formatRomania } from '@/lib/timezone';
import { EmployeeDayData, Segment } from '@/types/timeApproval';

interface UniformizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedByEmployee: EmployeeDayData[];
  onConfirm: (avgClockIn: string, avgClockOut: string | null) => void;
}

export const UniformizeDialog = ({
  open,
  onOpenChange,
  groupedByEmployee,
  onConfirm,
}: UniformizeDialogProps) => {
  // Detectează șoferii (cei care conduc efectiv)
  const isDriver = (segments: Segment[]) => {
    return segments.some(s => s.type === 'hours_driving' || s.type === 'hours_equipment');
  };

  // Calculează media echipei (exclude șoferii și entries missing)
  const calculateTeamAverage = () => {
    const nonDrivers = groupedByEmployee.filter(emp => 
      !isDriver(emp.segments) && emp.firstClockIn !== null
    );
    
    if (nonDrivers.length === 0) {
      return { avgClockIn: null, avgClockOut: null };
    }

    const clockIns = nonDrivers.map(emp => {
      const date = new Date(emp.firstClockIn);
      return date.getHours() * 60 + date.getMinutes();
    });

    const clockOuts = nonDrivers
      .filter(emp => emp.lastClockOut)
      .map(emp => {
        const date = new Date(emp.lastClockOut!);
        return date.getHours() * 60 + date.getMinutes();
      });

    const avgClockInMinutes = Math.round(clockIns.reduce((a, b) => a + b, 0) / clockIns.length);
    const avgClockOutMinutes = clockOuts.length > 0 
      ? Math.round(clockOuts.reduce((a, b) => a + b, 0) / clockOuts.length)
      : null;

    const avgClockIn = `${Math.floor(avgClockInMinutes / 60).toString().padStart(2, '0')}:${(avgClockInMinutes % 60).toString().padStart(2, '0')}`;
    const avgClockOut = avgClockOutMinutes 
      ? `${Math.floor(avgClockOutMinutes / 60).toString().padStart(2, '0')}:${(avgClockOutMinutes % 60).toString().padStart(2, '0')}`
      : null;

    return { avgClockIn, avgClockOut };
  };

  const teamAverage = calculateTeamAverage();
  const nonDrivers = groupedByEmployee.filter(emp => !isDriver(emp.segments) && emp.firstClockIn !== null);
  const drivers = groupedByEmployee.filter(emp => isDriver(emp.segments) && emp.firstClockIn !== null);

  const handleConfirm = () => {
    if (teamAverage.avgClockIn) {
      onConfirm(teamAverage.avgClockIn, teamAverage.avgClockOut);
      onOpenChange(false);
    }
  };

  if (!teamAverage.avgClockIn) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Uniformizare Ore Echipă</AlertDialogTitle>
          <AlertDialogDescription>
            Această acțiune va alinia orele de pontaj ale tuturor angajaților (exclus șoferii) la media echipei.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Media calculată */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-semibold mb-2">Noile ore (media echipei):</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Clock In:</div>
                <div className="text-2xl font-mono font-bold">{teamAverage.avgClockIn}</div>
              </div>
              {teamAverage.avgClockOut && (
                <div>
                  <div className="text-sm text-muted-foreground">Clock Out:</div>
                  <div className="text-2xl font-mono font-bold">{teamAverage.avgClockOut}</div>
                </div>
              )}
            </div>
          </div>

          {/* Angajați afectați */}
          <div>
            <h4 className="font-semibold mb-2">Se va aplica la:</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {nonDrivers.map(emp => (
                <div key={emp.userId} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span className="font-medium">{emp.fullName}</span>
                    <span className="text-xs text-muted-foreground">@{emp.username}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {emp.firstClockIn ? (
                      <>
                        Curent: {formatRomania(emp.firstClockIn, 'HH:mm')}
                        {emp.lastClockOut && ` - ${formatRomania(emp.lastClockOut, 'HH:mm')}`}
                      </>
                    ) : (
                      <span className="text-red-500">Lipsă pontaj</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Șoferi excluși */}
          {drivers.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Excluși din uniformizare:</h4>
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {drivers.map(emp => (
                  <div key={emp.userId} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">✗</span>
                      <span className="font-medium">{emp.fullName}</span>
                      <Badge variant="secondary" className="text-xs">🚗 Șofer</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {emp.firstClockIn ? (
                        <>
                          Păstrează: {formatRomania(emp.firstClockIn, 'HH:mm')}
                          {emp.lastClockOut && ` - ${formatRomania(emp.lastClockOut, 'HH:mm')}`}
                        </>
                      ) : (
                        <span className="text-red-500">Lipsă pontaj</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Atenție:</strong> Această acțiune va modifica toate orele de clock in/out pentru angajații selectați și va recalcula automat segmentele de timp.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Anulează</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Confirmă Uniformizarea
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
