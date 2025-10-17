import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Clock, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';

interface AddMissingEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    userId: string;
    fullName: string;
    username: string;
    scheduledShift?: string;
    scheduledLocation?: string;
  };
  workDate: Date;
  onConfirm: (data: {
    clockIn: string;
    clockOut: string;
    shiftType: string;
    notes: string;
  }) => void;
}

export function AddMissingEntryDialog({
  open,
  onOpenChange,
  employee,
  workDate,
  onConfirm,
}: AddMissingEntryDialogProps) {
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [shiftType, setShiftType] = useState(employee.scheduledShift || 'normal'); // ✅ FIX: Default value corect
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // ✅ Validare automată când se schimbă valorile (live feedback)
  useEffect(() => {
    if (clockIn || clockOut) {
      validate(); // Validare live pentru feedback imediat
    }
  }, [clockIn, clockOut, workDate]);

  // Validare
  const validate = () => {
    const errs: string[] = [];

    if (!clockIn) errs.push('Clock In este obligatoriu');
    if (!clockOut) errs.push('Clock Out este obligatoriu');

    if (clockIn && clockOut) {
      const [inH, inM] = clockIn.split(':').map(Number);
      const [outH, outM] = clockOut.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;

      if (outMinutes <= inMinutes) {
        errs.push('Clock Out trebuie să fie după Clock In');
      }

      const totalMinutes = outMinutes - inMinutes;
      const totalHours = totalMinutes / 60;

      if (totalHours > 24) {
        errs.push(`Durată prea mare: ${totalHours.toFixed(1)}h (max 24h)`);
      }

      if (totalHours < 0.17) { // 10 min
        errs.push(`Durată prea mică: ${(totalHours * 60).toFixed(0)} min (min 10 min)`);
      }
    }

    // Warning pentru zile vechi
    const daysAgo = differenceInDays(new Date(), workDate);
    if (daysAgo > 7) {
      errs.push(`⚠️ WARNING: Adaugi pontaj pentru ${daysAgo} zile în urmă`);
    }

    setErrors(errs);
    return errs.filter(e => !e.includes('WARNING')).length === 0;
  };

  const handleSubmit = () => {
    console.log('[AddMissingEntry] Submit clicked', { clockIn, clockOut, shiftType, notes, workDate });
    
    const isValid = validate();
    console.log('[AddMissingEntry] Validation result:', { isValid, errors });
    
    if (!isValid) {
      console.error('[AddMissingEntry] Validation failed, blocking submit');
      return;
    }
    
    console.log('[AddMissingEntry] Validation passed, calling onConfirm');

    // ✅ FIX 1: Asigură-te că workDate este Date valid
    const baseDate = workDate instanceof Date ? workDate : new Date(workDate);
    
    // Construiește timestamp-uri complete
    const clockInDateTime = new Date(baseDate);
    const [inH, inM] = clockIn.split(':').map(Number);
    clockInDateTime.setHours(inH, inM, 0, 0);

    const clockOutDateTime = new Date(baseDate);
    const [outH, outM] = clockOut.split(':').map(Number);
    clockOutDateTime.setHours(outH, outM, 0, 0);

    // Dacă clockOut e înainte de clockIn (ex: 08:00 -> 02:00 a doua zi), adaugă 1 zi
    if (clockOutDateTime <= clockInDateTime) {
      clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
    }

    onConfirm({
      clockIn: clockInDateTime.toISOString(),
      clockOut: clockOutDateTime.toISOString(),
      shiftType, // ✅ Deja corect datorită fix-ului din Select
      notes: notes || 'Adăugat manual - uitat să se ponteze',
    });

    // Reset
    setClockIn('');
    setClockOut('');
    setNotes('');
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Adaugă Pontaj Manual
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-1">
              <p className="font-semibold">{employee.fullName}</p>
              <p className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(workDate, 'EEEE, d MMMM yyyy', { locale: ro })}
              </p>
              {employee.scheduledLocation && (
                <p className="text-xs">📍 {employee.scheduledLocation}</p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Clock In */}
          <div>
            <Label htmlFor="clockIn">Intrare (Clock In) *</Label>
            <Input
              id="clockIn"
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* Clock Out */}
          <div>
            <Label htmlFor="clockOut">Ieșire (Clock Out) *</Label>
            <Input
              id="clockOut"
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* Shift Type */}
          <div>
            <Label>Tip Tură</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">☀️ Zi (Normal)</SelectItem>
                  <SelectItem value="night">🌙 Noapte</SelectItem>
                  <SelectItem value="passenger">👥 Pasager</SelectItem>
                  <SelectItem value="driver">🚗 Șofer</SelectItem>
                </SelectContent>
              </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Observații</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Uitat să se ponteze, confirmă prezența"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Errors/Warnings */}
          {errors.length > 0 && (
            <Alert variant={errors.some(e => e.includes('WARNING')) ? 'default' : 'destructive'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="text-sm space-y-1">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              !clockIn || 
              !clockOut || 
              !shiftType || 
              errors.some(e => !e.includes('WARNING'))
            }
            className="gap-2"
          >
            {!clockIn || !clockOut || !shiftType 
              ? '⚠️ Completează toate câmpurile' 
              : 'Salvează Pontaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
