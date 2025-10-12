import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Search, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const dayNames = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

export function AllScheduleNotifications() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Fetch TOATE notificările (nu limitate la 30 zile)
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['all-schedule-notifications', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('schedule_notifications')
        .select(`
          *,
          weekly_schedules (
            team_id,
            week_start_date,
            day_of_week,
            location,
            activity,
            shift_type
          ),
          profiles!schedule_notifications_user_id_fkey (
            full_name,
            username
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200); // Limită de 200 notificări pentru performanță

      if (statusFilter === 'unread') {
        query = query.is('read_at', null);
      } else if (statusFilter === 'read') {
        query = query.not('read_at', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Auto-refresh la 30 secunde
  });

  // Filtrare locală după nume angajat
  const filteredNotifications = notifications?.filter((notif: any) => {
    if (!searchTerm) return true;
    const profile = notif.profiles;
    const searchLower = searchTerm.toLowerCase();
    return (
      profile?.full_name?.toLowerCase().includes(searchLower) ||
      profile?.username?.toLowerCase().includes(searchLower)
    );
  });

  // Statistici
  const stats = {
    total: notifications?.length || 0,
    unread: notifications?.filter((n: any) => !n.read_at).length || 0,
    read: notifications?.filter((n: any) => n.read_at).length || 0,
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Istoric Complet Notificări
          </CardTitle>
          <CardDescription>Se încarcă...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Istoric Complet Notificări
            </CardTitle>
            <CardDescription>
              Toate notificările de programare și realocări
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{stats.unread}</p>
              <p className="text-muted-foreground">Necitite</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{stats.read}</p>
              <p className="text-muted-foreground">Citite</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtre */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută după nume angajat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              <SelectItem value="unread">Necitite</SelectItem>
              <SelectItem value="read">Citite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabel */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[150px]">Tip</TableHead>
                <TableHead>Angajat</TableHead>
                <TableHead className="text-center">Echipă</TableHead>
                <TableHead className="text-center">Zi</TableHead>
                <TableHead className="text-center">Tură</TableHead>
                <TableHead>Locație</TableHead>
                <TableHead className="text-center">Data Notificării</TableHead>
                <TableHead className="text-center">Citită La</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredNotifications || filteredNotifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nu s-au găsit notificări
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotifications.map((notif: any) => {
                  const schedule = notif.weekly_schedules;
                  const profile = notif.profiles;
                  const isRead = !!notif.read_at;

                  return (
                    <TableRow key={notif.id} className={isRead ? 'opacity-60' : ''}>
                      <TableCell>
                        {isRead ? (
                          <BellOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Bell className="h-4 w-4 text-red-500 animate-pulse" />
                        )}
                      </TableCell>
                      <TableCell>
                        {notif.notification_type === 'team_reassignment' ? (
                          <Badge variant="secondary" className="gap-1">
                            <ArrowRightLeft className="h-3 w-3" />
                            Mutare
                          </Badge>
                        ) : notif.notification_type === 'schedule_updated' ? (
                          <Badge variant="outline">Modificare</Badge>
                        ) : (
                          <Badge>Nouă</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {profile?.full_name || profile?.username || 'N/A'}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {schedule.team_id}
                      </TableCell>
                      <TableCell className="text-center">
                        {dayNames[schedule.day_of_week - 1]}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={schedule.shift_type === 'noapte' ? 'secondary' : 'default'}>
                          {schedule.shift_type === 'zi' ? '☀️' : '🌙'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {schedule.location || '-'}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {format(new Date(notif.created_at), 'dd MMM, HH:mm', { locale: ro })}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {isRead
                          ? format(new Date(notif.read_at), 'dd MMM, HH:mm', { locale: ro })
                          : <span className="text-red-500 font-semibold">Necitită</span>
                        }
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredNotifications && filteredNotifications.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Se afișează {filteredNotifications.length} notificări din {stats.total} total
          </p>
        )}
      </CardContent>
    </Card>
  );
}
