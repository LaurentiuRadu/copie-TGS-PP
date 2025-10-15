import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays } from 'date-fns';

interface TardinessInfo {
  isLate: boolean;
  delayMinutes: number;
  scheduledTime: string | null;
}

export const useTardinessCheck = (userId: string | undefined, enabled: boolean = true) => {
  const [tardinessInfo, setTardinessInfo] = useState<TardinessInfo>({
    isLate: false,
    delayMinutes: 0,
    scheduledTime: null,
  });

  useEffect(() => {
    if (!userId || !enabled) return;

    const checkTardiness = async () => {
      try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Duminică, 1=Luni, ..., 6=Sâmbătă
        
        // Convertim la formatul backend: 1=Luni, ..., 7=Duminică
        const backendDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
        
        // Găsește începutul săptămânii curente (Luni)
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekStartDate = format(weekStart, 'yyyy-MM-dd');

        // Verifică dacă există un program pentru astăzi
        const { data: schedules, error } = await supabase
          .from('weekly_schedules')
          .select('*')
          .eq('user_id', userId)
          .eq('week_start_date', weekStartDate)
          .eq('day_of_week', backendDayOfWeek);

        if (error) {
          console.error('Error checking schedule:', error);
          return;
        }

        if (!schedules || schedules.length === 0) {
          // Nu există program pentru astăzi
          setTardinessInfo({
            isLate: false,
            delayMinutes: 0,
            scheduledTime: null,
          });
          return;
        }

        // Determină ora programată în funcție de shift_type
        const shiftType = schedules[0].shift_type || 'zi';
        const scheduledDate = new Date(now);
        
        // Configurare ore programate
        if (shiftType === 'zi') {
          scheduledDate.setHours(8, 0, 0, 0); // Tura zi: 08:00
        } else if (shiftType === 'noapte') {
          scheduledDate.setHours(22, 0, 0, 0); // Tura noapte: 22:00
        } else {
          scheduledDate.setHours(8, 0, 0, 0); // Default: 08:00
        }

        // Calculează ora limită (ora programată + toleranță)
        const toleranceMinutes = 20;
        const limitTime = new Date(scheduledDate);
        limitTime.setMinutes(limitTime.getMinutes() + toleranceMinutes);

        // Calculează întârzierea față de ora limită (nu față de ora programată)
        const actualDelayMs = now.getTime() - limitTime.getTime();
        const actualDelayMinutes = Math.floor(actualDelayMs / (1000 * 60));

        // Marcăm ca întârziere doar dacă depășește ora limită
        const isLate = actualDelayMinutes > 0;

        setTardinessInfo({
          isLate,
          delayMinutes: isLate ? actualDelayMinutes : 0,
          scheduledTime: isLate ? scheduledDate.toISOString() : null,
        });
      } catch (error) {
        console.error('Error in tardiness check:', error);
      }
    };

    checkTardiness();
  }, [userId, enabled]);

  return tardinessInfo;
};
