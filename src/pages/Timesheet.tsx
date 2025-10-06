import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { Table as TableIcon, ChevronLeft, ChevronRight, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type TimeEntry = {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  profiles?: {
    full_name: string | null;
    username: string | null;
  };
};

type TimesheetEntry = {
  userId: string;
  userName: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  total: string;
};

const Timesheet = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-for-timesheet'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: timeEntries, isLoading: loadingEntries, refetch } = useQuery({
    queryKey: ['timesheet-entries', weekStart.toISOString(), weekEnd.toISOString(), selectedUser],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select(`
          id,
          user_id,
          clock_in_time,
          clock_out_time,
          notes,
          time_entry_segments(*)
        `)
        .gte('clock_in_time', weekStart.toISOString())
        .lte('clock_in_time', weekEnd.toISOString())
        .order('clock_in_time', { ascending: true });

      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(data?.map(e => e.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      // Combine data
      const entriesWithProfiles = data?.map(entry => ({
        ...entry,
        profiles: profiles?.find(p => p.id === entry.user_id)
      }));

      return entriesWithProfiles as TimeEntry[];
    },
  });

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel('timesheet-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entry_segments' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const calculateHours = (entries: TimeEntry[]): string => {
    let totalMinutes = 0;
    
    entries.forEach(entry => {
      if (entry.clock_out_time) {
        const clockIn = new Date(entry.clock_in_time);
        const clockOut = new Date(entry.clock_out_time);
        const diffMs = clockOut.getTime() - clockIn.getTime();
        totalMinutes += Math.floor(diffMs / (1000 * 60));
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const getEntriesForDay = (userId: string, day: Date): TimeEntry[] => {
    if (!timeEntries) return [];
    return timeEntries.filter(
      entry => entry.user_id === userId && isSameDay(parseISO(entry.clock_in_time), day)
    );
  };

  const generateTimesheetData = (): TimesheetEntry[] => {
    if (!timeEntries || !users) return [];

    const relevantUsers = selectedUser === 'all' 
      ? users 
      : users.filter(u => u.id === selectedUser);

    return relevantUsers.map(user => {
      const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = weekDays.map(day =>
        calculateHours(getEntriesForDay(user.id, day))
      );

      const allWeekEntries = timeEntries.filter(e => e.user_id === user.id);
      const total = calculateHours(allWeekEntries);

      return {
        userId: user.id,
        userName: user.full_name || user.username || 'N/A',
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
        total,
      };
    });
  };

  const timesheetData = generateTimesheetData();

  const handlePreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleExportExcel = () => {
    if (!timesheetData.length) {
      toast.error("Nu există date de exportat");
      return;
    }

    const worksheetData = [
      ['Angajat', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică', 'Total'],
      ...timesheetData.map(row => [
        row.userName,
        row.monday,
        row.tuesday,
        row.wednesday,
        row.thursday,
        row.friday,
        row.saturday,
        row.sunday,
        row.total,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

    const fileName = `Timesheet_${format(weekStart, 'dd-MM-yyyy', { locale: ro })}_${format(weekEnd, 'dd-MM-yyyy', { locale: ro })}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Timesheet exportat cu succes");
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TableIcon className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Timesheet</h1>
        </div>
        <p className="text-muted-foreground">
          Pontaje săptămânale pentru toți angajații
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {format(weekStart, 'dd MMM', { locale: ro })} - {format(weekEnd, 'dd MMM yyyy', { locale: ro })}
                </div>
              </CardTitle>
              <CardDescription>
                Ore lucrate pe zile ale săptămânii
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Toți angajații" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toți angajații</SelectItem>
                  {users?.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers || loadingEntries ? (
            <p className="text-center text-muted-foreground py-8">Se încarcă datele...</p>
          ) : !timesheetData.length ? (
            <p className="text-center text-muted-foreground py-8">
              Nu există pontaje pentru această săptămână
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Angajat</TableHead>
                    {weekDays.map(day => (
                      <TableHead key={day.toISOString()} className="text-center">
                        <div className="flex flex-col">
                          <span className="font-bold">{format(day, 'EEE', { locale: ro })}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(day, 'dd.MM')}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheetData.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell className="text-center">{row.monday}</TableCell>
                      <TableCell className="text-center">{row.tuesday}</TableCell>
                      <TableCell className="text-center">{row.wednesday}</TableCell>
                      <TableCell className="text-center">{row.thursday}</TableCell>
                      <TableCell className="text-center">{row.friday}</TableCell>
                      <TableCell className="text-center">{row.saturday}</TableCell>
                      <TableCell className="text-center">{row.sunday}</TableCell>
                      <TableCell className="text-center font-bold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Timesheet;
