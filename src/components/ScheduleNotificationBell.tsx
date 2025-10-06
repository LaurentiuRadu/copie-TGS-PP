import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScheduleNotifications } from '@/hooks/useScheduleNotifications';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export function ScheduleNotificationBell() {
  const { notifications, unreadCount, markAsRead } = useScheduleNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-20 w-20">
          <Bell className="h-8 w-8" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-7 w-7 flex items-center justify-center p-0 text-sm font-bold"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Programări Noi</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {unreadCount} {unreadCount === 1 ? 'notificare nouă' : 'notificări noi'}
            </p>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {!notifications || notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nu ai notificări noi
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification: any) => {
                const schedule = notification.weekly_schedules;
                return (
                  <div key={notification.id} className="p-4 hover:bg-accent">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">Programare nouă - Echipa {schedule.team_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {dayNames[schedule.day_of_week - 1]}, {format(new Date(schedule.week_start_date), 'dd MMM yyyy', { locale: ro })}
                        </p>
                        {schedule.location && (
                          <p className="text-sm">📍 {schedule.location}</p>
                        )}
                        {schedule.activity && (
                          <p className="text-sm">🔧 {schedule.activity}</p>
                        )}
                        {schedule.vehicle && (
                          <p className="text-sm">🚗 {schedule.vehicle}</p>
                        )}
                        {schedule.observations && (
                          <p className="text-sm text-muted-foreground">{schedule.observations}</p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => markAsRead.mutate(notification.id)}
                        className="shrink-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
