import React from 'react';
import { MobileTableCard, MobileTableRow } from '@/components/MobileTableCard';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, ArrowRightLeft, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface NotificationCardProps {
  notification: {
    id: string;
    notification_type: string;
    read_at: string | null;
    created_at: string;
    metadata?: any;
    weekly_schedules: {
      team_id: string;
      day_of_week: number;
      shift_type: string;
      location: string;
    };
    profiles: {
      full_name: string;
      username: string;
    };
  };
}

const dayNames = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

export const NotificationCard = React.memo(({ notification }: NotificationCardProps) => {
  const schedule = notification.weekly_schedules;
  const profile = notification.profiles;
  const isRead = !!notification.read_at;

  const getTypeBadge = () => {
    if (notification.notification_type === 'team_reassignment') {
      return (
        <Badge variant="secondary" className="gap-1">
          <ArrowRightLeft className="h-3 w-3" />
          {notification.metadata?.previous_team_id} → {notification.metadata?.new_team_id}
        </Badge>
      );
    }
    if (notification.notification_type === 'schedule_updated') {
      return (
        <Badge variant="outline" className="gap-1.5">
          {notification.metadata?.shift_type === 'zi' ? (
            <Sun className="h-3 w-3" />
          ) : (
            <Moon className="h-3 w-3" />
          )}
          {notification.metadata?.location || 'Modificare'}
        </Badge>
      );
    }
    return <Badge>Nouă</Badge>;
  };

  return (
    <MobileTableCard>
      <div className={isRead ? 'opacity-60' : ''}>
        {/* Header: Status + Type */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
          {isRead ? (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4 text-red-500 animate-pulse" />
          )}
          {getTypeBadge()}
        </div>

        {/* Employee Info */}
        <MobileTableRow
          label="Angajat"
          value={
            <div>
              <p className="font-medium">{profile?.full_name || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">@{profile?.username}</p>
            </div>
          }
          fullWidth
        />

        {/* Team & Day */}
        <div className="flex gap-4 py-2 border-b border-border/50">
          <MobileTableRow
            label="Echipă"
            value={<span className="font-semibold">{schedule.team_id}</span>}
          />
          <MobileTableRow
            label="Zi"
            value={
              schedule.day_of_week && schedule.day_of_week >= 1 && schedule.day_of_week <= 7
                ? dayNames[schedule.day_of_week - 1]
                : 'N/A'
            }
          />
        </div>

        {/* Shift & Location */}
        <MobileTableRow
          label="Tură"
          value={
            <Badge variant={schedule.shift_type === 'noapte' ? 'secondary' : 'default'} className="gap-1.5">
              {schedule.shift_type === 'zi' ? (
                <Sun className="h-3 w-3" />
              ) : (
                <Moon className="h-3 w-3" />
              )}
            </Badge>
          }
        />

        <MobileTableRow
          label="Locație"
          value={schedule.location || '-'}
        />

        {/* Timestamps */}
        <MobileTableRow
          label="Data Notificării"
          value={format(new Date(notification.created_at), 'dd MMM, HH:mm', { locale: ro })}
        />

        <MobileTableRow
          label="Citită La"
          value={
            isRead
              ? format(new Date(notification.read_at), 'dd MMM, HH:mm', { locale: ro })
              : <span className="text-red-500 font-semibold">Necitită</span>
          }
        />
      </div>
    </MobileTableCard>
  );
});

NotificationCard.displayName = 'NotificationCard';
