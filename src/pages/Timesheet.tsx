import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, addWeeks, subWeeks, startOfMonth, endOfMonth } from "date-fns";
import { ro } from "date-fns/locale";
import { Table as TableIcon, ChevronLeft, ChevronRight, Download, Calendar as CalendarIcon, RefreshCw, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useWeeklyTimesheets, DailyTimesheet } from "@/hooks/useDailyTimesheets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTimeEntries } from "@/hooks/useRealtimeTimeEntries";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { exportToPayrollCSV } from "@/lib/exportUtils";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfMonth(new Date()));
  
  const { userRole } = useAuth();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Enable realtime updates
  useRealtimeTimeEntries(true);

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

  const { data: timesheets, isLoading: loadingTimesheets } = useWeeklyTimesheets(
    weekStart,
    selectedUser === 'all' ? undefined : selectedUser
  );

  // Debug logging
  console.log('[Timesheet Debug] Week range:', {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    timesheetsCount: timesheets?.length || 0,
    usersCount: users?.length || 0,
  });

  if (timesheets && timesheets.length > 0) {
    const oct5Data = timesheets.filter(t => t.work_date === '2025-10-05');
    console.log('[Timesheet Debug] Data for 2025-10-05:', {
      count: oct5Data.length,
      employees: oct5Data.map(t => ({
        name: (t.profiles as any)?.full_name,
        total: t.hours_regular + t.hours_night + t.hours_saturday + t.hours_sunday + 
               t.hours_holiday + t.hours_passenger + t.hours_driving + t.hours_equipment +
               t.hours_leave + t.hours_medical_leave
      }))
    });
  }

  const formatHours = (hours: number): string => {
    if (hours === 0) return '-';
    return `${hours.toFixed(1)}h`;
  };

  const getTimesheetsForDay = (userId: string, day: Date): DailyTimesheet[] => {
    if (!timesheets) return [];
    const dayStr = day.toISOString().split('T')[0];
    return timesheets.filter(
      sheet => sheet.employee_id === userId && sheet.work_date === dayStr
    );
  };

  const calculateDayHours = (userId: string, day: Date): string => {
    const sheets = getTimesheetsForDay(userId, day);
    if (sheets.length === 0) return '-';

    const totalHours = sheets.reduce((sum, sheet) => {
      return sum +
        sheet.hours_regular +
        sheet.hours_night +
        sheet.hours_saturday +
        sheet.hours_sunday +
        sheet.hours_holiday +
        sheet.hours_passenger +
        sheet.hours_driving +
        sheet.hours_equipment +
        sheet.hours_leave +
        sheet.hours_medical_leave;
    }, 0);

    const dayStr = day.toISOString().split('T')[0];
    if (dayStr === '2025-10-05' && totalHours > 0) {
      console.log('[Timesheet Debug] calculateDayHours for Oct 5:', {
        userId,
        sheetsCount: sheets.length,
        totalHours,
        sheets: sheets.map(s => ({
          hours_sunday: s.hours_sunday,
          hours_driving: s.hours_driving,
          total: s.hours_regular + s.hours_night + s.hours_saturday + s.hours_sunday + 
                 s.hours_holiday + s.hours_passenger + s.hours_driving + s.hours_equipment +
                 s.hours_leave + s.hours_medical_leave
        }))
      });
    }

    return formatHours(totalHours);
  };

  const calculateWeekTotalHours = (userId: string): string => {
    if (!timesheets) return '-';
    
    const userSheets = timesheets.filter(sheet => sheet.employee_id === userId);
    if (userSheets.length === 0) return '-';

    const totalHours = userSheets.reduce((sum, sheet) => {
      return sum +
        sheet.hours_regular +
        sheet.hours_night +
        sheet.hours_saturday +
        sheet.hours_sunday +
        sheet.hours_holiday +
        sheet.hours_passenger +
        sheet.hours_driving +
        sheet.hours_equipment +
        sheet.hours_leave +
        sheet.hours_medical_leave;
    }, 0);

    return formatHours(totalHours);
  };

  const generateTimesheetData = (): TimesheetEntry[] => {
    if (!timesheets || !users) return [];

    const relevantUsers = selectedUser === 'all' 
      ? users 
      : users.filter(u => u.id === selectedUser);

    console.log('[Timesheet Debug] Generating data for users:', relevantUsers.length);

    return relevantUsers.map(user => {
      const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = weekDays.map(day =>
        calculateDayHours(user.id, day)
      );

      const total = calculateWeekTotalHours(user.id);

      // Log users with hours on Sunday (Oct 5)
      if (sunday !== '-') {
        console.log('[Timesheet Debug] User with Sunday hours:', {
          name: user.full_name,
          sunday
        });
      }

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

  const handleProcessHistoricalTimesheets = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-historical-timesheets', {
        body: { process_last_24h: false }
      });

      if (error) throw error;

      const processed = data?.processed_entries || 0;
      const generated = data?.generated_timesheets || 0;

      toast.success(`Procesare completă: ${processed} pontaje procesate, ${generated} timesheets generate`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['weekly-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
    } catch (error: any) {
      console.error('Error processing timesheets:', error);
      toast.error(error.message || "Eroare la procesarea pontajelor");
    } finally {
      setIsProcessing(false);
    }
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

  const handleExportPayrollCSV = async () => {
    if (!selectedDate) {
      toast.error("Selectează ziua pentru export");
      return;
    }

    try {
      // Fetch data for selected day
      const { data, error } = await supabase
        .from('daily_timesheets')
        .select(`
          *,
          profiles:employee_id (
            username,
            full_name
          )
        `)
        .eq('work_date', format(selectedDate, 'yyyy-MM-dd'))
        .order('work_date');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Nu există date pentru ziua selectată");
        return;
      }

      exportToPayrollCSV(data as any, selectedDate, selectedDate);
      
      toast.success(`Raport generat pentru ${format(selectedDate, 'dd.MM.yyyy')}`);
    } catch (error: any) {
      console.error('Error exporting payroll:', error);
      toast.error(error.message || "Eroare la generarea raportului");
    }
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
                  <CalendarIcon className="h-5 w-5" />
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

              {userRole === 'admin' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" disabled={isProcessing}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                      Procesează Pontaje
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Procesează pontaje istorice?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Această acțiune va procesa toate pontajele din baza de date și va regenera timesheets-urile pentru toate zilele.
                        Procesul poate dura câteva momente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anulează</AlertDialogCancel>
                      <AlertDialogAction onClick={handleProcessHistoricalTimesheets}>
                        Procesează
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export Payroll CSV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export Raport Zilnic Payroll</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Selectează ziua pentru export:
                    </div>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border pointer-events-auto"
                    />
                    <Button onClick={handleExportPayrollCSV} className="w-full">
                      Generează CSV
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers || loadingTimesheets ? (
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
