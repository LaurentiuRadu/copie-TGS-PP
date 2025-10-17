import React from 'react';
import { MobileTableCard, MobileTableRow } from '@/components/MobileTableCard';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface TeamVerificationCardProps {
  member: {
    user_id: string;
    full_name: string;
    username: string;
    entries: Record<number, any[]>;
  };
  selectedWeek: string;
  teamStats: {
    avgClockIn: string;
    avgClockOut: string;
  } | null;
  isTeamLeader: boolean;
}

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

const formatTime = (dateString: string | null) => {
  if (!dateString) return null;
  return format(new Date(dateString), 'HH:mm');
};

const getDiscrepancyLevel = (time: string, avgTime: string): 'ok' | 'moderate' | 'high' => {
  if (!time || !avgTime || avgTime === '-') return 'ok';
  
  const [timeH, timeM] = time.split(':').map(Number);
  const [avgH, avgM] = avgTime.split(':').map(Number);
  
  const timeMinutes = timeH * 60 + timeM;
  const avgMinutes = avgH * 60 + avgM;
  
  const diff = Math.abs(timeMinutes - avgMinutes);
  
  if (diff <= 15) return 'ok';
  if (diff <= 30) return 'moderate';
  return 'high';
};

export const TeamVerificationCard = React.memo(({ 
  member, 
  selectedWeek, 
  teamStats, 
  isTeamLeader 
}: TeamVerificationCardProps) => {
  return (
    <MobileTableCard>
      {/* Header: Name + Badge */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
        <div>
          <h3 className="font-medium">{member.full_name}</h3>
          <p className="text-xs text-muted-foreground">{member.username}</p>
        </div>
        {isTeamLeader && (
          <Badge variant="outline" className="text-xs">
            Șef Echipă
          </Badge>
        )}
      </div>

      {/* Days Grid */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
          const entries = member.entries[dayOfWeek] || [];
          const dayName = dayNames[dayOfWeek - 1];
          const dayDate = format(addDays(new Date(selectedWeek), dayOfWeek - 1), 'dd.MM');
          
          if (entries.length === 0) {
            return (
              <div key={dayOfWeek} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm font-medium">{dayName} ({dayDate})</span>
                <Badge variant="outline" className="text-muted-foreground">
                  Lipsă
                </Badge>
              </div>
            );
          }

          const entry = entries[0];
          const clockIn = formatTime(entry.clock_in_time);
          const clockOut = formatTime(entry.clock_out_time);
          
          const clockInLevel = teamStats ? getDiscrepancyLevel(clockIn!, teamStats.avgClockIn) : 'ok';
          const clockOutLevel = clockOut && teamStats ? getDiscrepancyLevel(clockOut, teamStats.avgClockOut) : 'ok';

          return (
            <div key={dayOfWeek} className="py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{dayName}</span>
                <span className="text-xs text-muted-foreground">{dayDate}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium",
                    clockInLevel === 'high' && "text-destructive",
                    clockInLevel === 'moderate' && "text-yellow-600 dark:text-yellow-500",
                    clockInLevel === 'ok' && "text-foreground"
                  )}>
                    {clockIn}
                  </span>
                  {clockInLevel === 'high' && <AlertCircle className="h-3 w-3 text-destructive" />}
                </div>
                <span>→</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    !clockOut && "text-muted-foreground italic",
                    clockOut && clockOutLevel === 'high' && "text-destructive",
                    clockOut && clockOutLevel === 'moderate' && "text-yellow-600 dark:text-yellow-500",
                    clockOut && clockOutLevel === 'ok' && "text-foreground"
                  )}>
                    {clockOut || 'În desfășurare'}
                  </span>
                  {clockOut && clockOutLevel === 'high' && <AlertCircle className="h-3 w-3 text-destructive" />}
                </div>
              </div>
              {entries.length > 1 && (
                <Badge variant="secondary" className="text-xs mt-1">
                  +{entries.length - 1} intrări
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </MobileTableCard>
  );
});

TeamVerificationCard.displayName = 'TeamVerificationCard';
