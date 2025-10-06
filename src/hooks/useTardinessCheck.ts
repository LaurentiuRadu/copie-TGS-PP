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

        // Presupunem că ora programată este 06:00 (sau se poate extrage din shift_type)
        // Pentru simplitate, setăm ora programată la 06:00
        const scheduledDate = new Date(now);
        scheduledDate.setHours(6, 0, 0, 0);

        // Calculează întârzierea
        const delayMs = now.getTime() - scheduledDate.getTime();
        const delayMinutes = Math.floor(delayMs / (1000 * 60));

        // Considerăm întârziere dacă sunt mai mult de 15 minute după ora programată
        const isLate = delayMinutes > 15;

        setTardinessInfo({
          isLate,
          delayMinutes: isLate ? delayMinutes : 0,
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
