import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface TeamEditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: 'Clock In' | 'Clock Out';
  employeeName: string;
  currentValue: string;
  newValue: string;
  affectedCount: number;
  employeesWithManualOverride?: string[];
  onConfirm: (scope: 'single' | 'team') => void;
}

export const TeamEditScopeDialog = ({
  open,
  onOpenChange,
  fieldName,
  employeeName,
  currentValue,
  newValue,
  affectedCount,
  employeesWithManualOverride = [],
  onConfirm,
}: TeamEditScopeDialogProps) => {
  const [scope, setScope] = useState<'single' | 'team'>('single');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Modificare {fieldName} pentru {employeeName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valoare curentă:</span>
                <span className="font-mono font-semibold">{currentValue}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valoare nouă:</span>
                <span className="font-mono font-semibold text-primary">{newValue}</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="space-y-3 mt-4">
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="single" id="single" />
            <Label htmlFor="single" className="flex-1 cursor-pointer">
              <div className="font-medium">🔸 Doar pentru {employeeName}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Modifică doar pontajul acestui angajat
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="team" id="team" />
            <Label htmlFor="team" className="flex-1 cursor-pointer">
              <div className="font-medium">🔸 Pentru toată echipa</div>
              <div className="text-xs text-muted-foreground mt-1">
                Se va aplica la <strong>{affectedCount} angajați</strong> (exclude șoferi și coordonatori)
              </div>
            </Label>
          </div>
        </RadioGroup>

        {/* Warning pentru editări manuale */}
        {scope === 'team' && employeesWithManualOverride.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg mt-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              ⚠️ Atenție: Editări manuale detectate
            </p>
            <ul className="text-xs mt-2 ml-4 list-disc text-yellow-700 dark:text-yellow-300">
              {employeesWithManualOverride.map(name => (
                <li key={name}>{name} - segmentarea manuală va fi ștearsă</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg mt-4">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            ℹ️ <strong>Segmentele vor fi recalculate automat</strong> folosind aceeași logică (zi/noapte/weekend/sărbătoare)
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Anulează</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(scope)}>
            Confirmă modificarea
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
