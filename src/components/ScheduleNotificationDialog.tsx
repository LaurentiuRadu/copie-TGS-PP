import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar, MapPin, Wrench, Car, MessageSquare, X, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

interface ScheduleNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: any;
  onMarkAsRead?: () => void;
}

export function ScheduleNotificationDialog({
  open,
  onOpenChange,
  notification,
  onMarkAsRead
}: ScheduleNotificationDialogProps) {
  if (!notification) return null;

  const schedule = notification.weekly_schedules;
  const isRead = !!notification.read_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold flex items-center gap-3">
            {notification.notification_type === 'team_reassignment' ? (
              <>
                <ArrowRightLeft className="h-8 w-8 text-amber-500" />
                🔄 Realocare în Altă Echipă
              </>
            ) : notification.notification_type === 'schedule_updated' ? (
              <>
                <Calendar className="h-8 w-8" />
                ✏️ Programare Modificată
              </>
            ) : (
              <>
                <Calendar className="h-8 w-8" />
                📅 Programare Nouă
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Alertă specială pentru mutări */}
          {notification.notification_type === 'team_reassignment' && notification.previous_team_id && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <ArrowRightLeft className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                  Ai fost realocat din echipa <strong>{notification.previous_team_id}</strong> în echipa <strong>{schedule.team_id}</strong>
                </p>
              </div>
              <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <p>📅 Ziua: <strong>{dayNames[schedule.day_of_week - 1]}</strong></p>
                <p>📆 Data: <strong>{format(addDays(new Date(schedule.week_start_date), schedule.day_of_week - 1), 'dd MMMM yyyy', { locale: ro })}</strong></p>
                <p className="mt-3 italic">⚠️ Te rugăm să verifici noul program și să te prezinți la echipa corectă.</p>
              </div>
            </div>
          )}

          {/* Echipa și Tura */}
          <div className="bg-primary/10 rounded-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Echipa</p>
                <p className="text-4xl font-bold">Echipa {schedule.team_id}</p>
              </div>
              <Badge 
                variant={schedule.shift_type === 'noapte' ? 'secondary' : 'default'} 
                className="text-xl px-4 py-2 h-auto"
              >
                {schedule.shift_type === 'zi' ? '☀️ Zi' : '🌙 Noapte'}
              </Badge>
            </div>
          </div>

          {/* Ziua și Data */}
          <div className="bg-accent/50 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">Dată</p>
            </div>
            <p className="text-3xl font-semibold">
              {dayNames[schedule.day_of_week - 1]}
            </p>
            <p className="text-xl text-muted-foreground mt-1">
              {format(new Date(schedule.week_start_date), 'dd MMMM yyyy', { locale: ro })}
            </p>
          </div>

          {/* Locație */}
          {schedule.location && (
            <div className="bg-accent/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="h-6 w-6 text-primary" />
                <p className="text-sm text-muted-foreground">Locație</p>
              </div>
              <p className="text-2xl font-medium">{schedule.location}</p>
            </div>
          )}

          {/* Activitate */}
          {schedule.activity && (
            <div className="bg-accent/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Wrench className="h-6 w-6 text-primary" />
                <p className="text-sm text-muted-foreground">Activitate</p>
              </div>
              <p className="text-2xl font-medium">{schedule.activity}</p>
            </div>
          )}

          {/* Vehicul */}
          {schedule.vehicle && (
            <div className="bg-accent/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Car className="h-6 w-6 text-primary" />
                <p className="text-sm text-muted-foreground">Vehicul</p>
              </div>
              <p className="text-2xl font-medium">{schedule.vehicle}</p>
            </div>
          )}

          {/* Observații */}
          {schedule.observations && (
            <div className="bg-accent/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="h-6 w-6 text-primary" />
                <p className="text-sm text-muted-foreground">Observații</p>
              </div>
              <p className="text-xl leading-relaxed">{schedule.observations}</p>
            </div>
          )}

          {/* Butoane de acțiune */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              size="lg"
              className="flex-1 text-lg h-14"
            >
              <X className="h-5 w-5 mr-2" />
              Închide
            </Button>
            {!isRead && onMarkAsRead && (
              <Button
                onClick={() => {
                  onMarkAsRead();
                  onOpenChange(false);
                }}
                size="lg"
                className="flex-1 text-lg h-14"
              >
                Marcat ca citit
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
