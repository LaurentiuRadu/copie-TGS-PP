import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TardinessReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  delayMinutes: number;
  scheduledTime: string;
}

export const TardinessReasonDialog = ({
  open,
  onClose,
  onSubmit,
  delayMinutes,
  scheduledTime,
}: TardinessReasonDialogProps) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Întârziere Detectată
          </DialogTitle>
          <DialogDescription>
            Ești cu {delayMinutes} minute întârziere față de programul tău.
            Te rugăm să precizezi motivul.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            <div className="text-sm space-y-1">
              <p><strong>Ora programată:</strong> {new Date(scheduledTime).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><strong>Întârziere:</strong> {delayMinutes} minute</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="reason">Motivul întârzierii *</Label>
          <Textarea
            id="reason"
            placeholder="Ex: Trafic intens, problemă personală, probleme cu transportul..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Motivul va fi trimis spre aprobare la administrator
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Anulează
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Se trimite...' : 'Trimite Justificarea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
