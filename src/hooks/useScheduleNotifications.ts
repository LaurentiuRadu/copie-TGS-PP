import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useScheduleNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notifications
  const { data: unreadNotifications } = useQuery({
    queryKey: ['schedule-notifications', 'unread', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('schedule_notifications')
        .select(`
          *,
          weekly_schedules (
            team_id,
            week_start_date,
            day_of_week,
            location,
            activity,
            vehicle,
            observations,
            shift_type
          ),
          profiles!schedule_notifications_user_id_fkey (
            full_name,
            username
          )
        `)
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Fetch read notifications (history - last 30 days)
  const { data: readNotifications } = useQuery({
    queryKey: ['schedule-notifications', 'history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('schedule_notifications')
        .select(`
          *,
          weekly_schedules (
            team_id,
            week_start_date,
            day_of_week,
            location,
            activity,
            vehicle,
            observations,
            shift_type
          ),
          profiles!schedule_notifications_user_id_fkey (
            full_name,
            username
          )
        `)
        .eq('user_id', user.id)
        .not('read_at', 'is', null)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('read_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Update unread count
  useEffect(() => {
    setUnreadCount(unreadNotifications?.length || 0);
  }, [unreadNotifications]);

  // Mark as read mutation
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('schedule_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
    }
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('schedule-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'schedule_notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['schedule-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    unreadNotifications,
    readNotifications,
    unreadCount,
    markAsRead
  };
};
