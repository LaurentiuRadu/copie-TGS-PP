import { useState } from 'react';
import { Bell, Check, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useScheduleNotifications } from '@/hooks/useScheduleNotifications';
import { ScheduleNotificationDialog } from './ScheduleNotificationDialog';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export function ScheduleNotificationBell() {
  const { unreadNotifications, readNotifications, unreadCount, markAsRead } = useScheduleNotifications();
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification);
    setDialogOpen(true);
  };

  const renderNotificationItem = (notification: any, isRead: boolean) => {
    const schedule = notification.weekly_schedules;
    return (
      <div 
        key={notification.id} 
        className="p-4 hover:bg-accent cursor-pointer transition-colors"
        onClick={() => handleNotificationClick(notification)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <p className="font-medium">Programare {isRead ? 'citită' : 'nouă'} - Echipa {schedule.team_id}</p>
            <p className="text-sm text-muted-foreground">
              {dayNames[schedule.day_of_week - 1]}, {format(new Date(schedule.week_start_date), 'dd MMM yyyy', { locale: ro })}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {schedule.shift_type && (
                <Badge variant={schedule.shift_type === 'noapte' ? 'secondary' : 'default'} className="text-xs">
                  {schedule.shift_type === 'zi' ? '☀️ Zi' : '🌙 Noapte'}
                </Badge>
              )}
            </div>
            {schedule.location && (
              <p className="text-sm">📍 {schedule.location}</p>
            )}
            {isRead && notification.read_at && (
              <p className="text-xs text-muted-foreground">
                Citită: {format(new Date(notification.read_at), 'dd MMM, HH:mm', { locale: ro })}
              </p>
            )}
          </div>
          {!isRead && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead.mutate(notification.id);
              }}
              className="shrink-0"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
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
        <PopoverContent className="w-96 p-0" align="end">
          <Tabs defaultValue="unread" className="w-full">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold mb-2">Notificări Programări</h3>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="unread" className="relative">
                  <Bell className="h-4 w-4 mr-2" />
                  Noi
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-2" />
                  Istoric
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="unread" className="m-0">
              <ScrollArea className="h-[400px]">
                {!unreadNotifications || unreadNotifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nu ai notificări noi
                  </div>
                ) : (
                  <div className="divide-y">
                    {unreadNotifications.map((notification: any) => 
                      renderNotificationItem(notification, false)
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <ScrollArea className="h-[400px]">
                {!readNotifications || readNotifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nu ai notificări citite în ultimele 30 zile
                  </div>
                ) : (
                  <div className="divide-y">
                    {readNotifications.map((notification: any) => 
                      renderNotificationItem(notification, true)
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      <ScheduleNotificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        notification={selectedNotification}
        onMarkAsRead={() => {
          if (selectedNotification && !selectedNotification.read_at) {
            markAsRead.mutate(selectedNotification.id);
          }
        }}
      />
    </>
  );
}
