import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Bell, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ClockOutReminderAlertProps {
  clockInTime: string;
  onClockOut: () => void;
  onDismiss: () => void;
  reminderHours?: number;
}

export const ClockOutReminderAlert = ({
  clockInTime,
  onClockOut,
  onDismiss,
  reminderHours = 10,
}: ClockOutReminderAlertProps) => {
  const [elapsedHours, setElapsedHours] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const updateElapsed = () => {
      const start = new Date(clockInTime).getTime();
      const now = Date.now();
      const hours = (now - start) / (1000 * 60 * 60);
      setElapsedHours(hours);
      setShow(hours >= reminderHours);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [clockInTime, reminderHours]);

  if (!show) return null;

  const handleDismiss = () => {
    setShow(false);
    onDismiss();
  };

  return (
    <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <Bell className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0 animate-pulse" />
          <div className="flex-1 space-y-2">
            <AlertTitle className="text-yellow-800 dark:text-yellow-200 text-base font-semibold">
              Reminder: Tură Activă de {elapsedHours.toFixed(1)} ore
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm">
              <p className="mb-2">
                Ai o tură activă de la {format(new Date(clockInTime), 'HH:mm', { locale: ro })}.
                Nu uita să pontezi ieșirea când termini!
              </p>
              <div className="flex flex-col xs:flex-row gap-2">
                <Button
                  size="sm"
                  onClick={onClockOut}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pontează Ieșirea Acum
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                >
                  Amintește-mi mai târziu
                </Button>
              </div>
            </AlertDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
};
