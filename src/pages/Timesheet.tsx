import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ro } from "date-fns/locale";
import { User, ChevronDown, ChevronUp, Sun, Moon, Calendar as CalendarIcon, Users, Truck, Wrench, Briefcase, HeartPulse, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { DailyTimesheet } from "@/hooks/useDailyTimesheets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { cn } from "@/lib/utils";
import { PayrollExportDialog } from "@/components/PayrollExportDialog";
import { SimpleDateRangePicker } from "@/components/ui/simple-date-range-picker";
import { toast } from "sonner";
import { TimeEntryReprocessButton } from "@/components/TimeEntryReprocessButton";

type EmployeeTimesheetData = {
  userId: string;
  userName: string;
  position: string;
  totalHours: number;
  daysWorked: number;
  timesheets: DailyTimesheet[];
  hoursByType: {
    regular: number;
    night: number;
    saturday: number;
    sunday: number;
    holiday: number;
    passenger: number;
    driving: number;
    equipment: number;
    leave: number;
    medical_leave: number;
  };
};

const Timesheet = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [currentMonth] = useState(new Date());
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<string>('');
  const [isReprocessSectionOpen, setIsReprocessSectionOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfMonth(currentMonth),
    to: endOfMonth(currentMonth),
  });
  
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Fetch all users with their roles
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          username, 
          full_name
        `)
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch user roles separately
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (error) throw error;
      return data;
    },
  });

  // Fetch all timesheets for the current month
  const { data: allTimesheets, isLoading: loadingTimesheets } = useQuery({
    queryKey: ['monthly-timesheets', format(monthStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_timesheets')
        .select(`
          *,
          profiles:employee_id (
            id,
            username,
            full_name
          )
        `)
        .gte('work_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('work_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('work_date', { ascending: true });

      if (error) throw error;
      return data as DailyTimesheet[];
    },
  });

  // Process employee data
  const employeeData: EmployeeTimesheetData[] = useMemo(() => {
    if (!users || !allTimesheets) return [];

    return users.map(user => {
      const userTimesheets = allTimesheets.filter(ts => ts.employee_id === user.id);
      
      const hoursByType = userTimesheets.reduce((acc, ts) => ({
        regular: acc.regular + ts.hours_regular,
        night: acc.night + ts.hours_night,
        saturday: acc.saturday + ts.hours_saturday,
        sunday: acc.sunday + ts.hours_sunday,
        holiday: acc.holiday + ts.hours_holiday,
        passenger: acc.passenger + ts.hours_passenger,
        driving: acc.driving + ts.hours_driving,
        equipment: acc.equipment + ts.hours_equipment,
        leave: acc.leave + ts.hours_leave,
        medical_leave: acc.medical_leave + ts.hours_medical_leave,
      }), {
        regular: 0,
        night: 0,
        saturday: 0,
        sunday: 0,
        holiday: 0,
        passenger: 0,
        driving: 0,
        equipment: 0,
        leave: 0,
        medical_leave: 0,
      });

      const totalHours = Object.values(hoursByType).reduce((sum, h) => sum + h, 0);
      const daysWorked = new Set(userTimesheets.map(ts => ts.work_date)).size;

      // Get position from user_roles
      const userRole = userRoles?.find(r => r.user_id === user.id);
      const position = userRole?.role || 'Angajat';

      return {
        userId: user.id,
        userName: user.full_name || user.username || 'N/A',
        position,
        totalHours,
        daysWorked,
        timesheets: userTimesheets,
        hoursByType,
      };
    }).filter(emp => emp.totalHours > 0); // Only show employees with hours
  }, [users, allTimesheets, userRoles]);

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employeeData;
    
    const query = searchQuery.toLowerCase();
    return employeeData.filter(emp => 
      emp.userName.toLowerCase().includes(query) ||
      emp.position.toLowerCase().includes(query)
    );
  }, [employeeData, searchQuery]);

  const toggleEmployee = (userId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedEmployees(newExpanded);
  };

  const formatHours = (hours: number): string => {
    return `${hours.toFixed(1)}h`;
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'EEEE', { locale: ro }).toLowerCase();
  };

  const getRowBackground = (dateStr: string) => {
    const dayOfWeek = getDayOfWeek(dateStr);
    if (dayOfWeek === 'duminică') return 'bg-red-50 dark:bg-red-950/20';
    if (dayOfWeek === 'sâmbătă') return 'bg-yellow-50 dark:bg-yellow-950/20';
    return 'bg-green-50 dark:bg-green-950/20';
  };

  const handleReprocess = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error('Selectează un interval de date');
      return;
    }

    setIsReprocessing(true);
    setReprocessProgress('Pornire re-procesare...');

    try {
      const startDate = dateRange.from.toISOString().split('T')[0];
      const endDate = dateRange.to.toISOString().split('T')[0];

      setReprocessProgress(`Re-procesare pentru ${startDate} → ${endDate}...`);

      const { data, error } = await supabase.functions.invoke('reprocess-all-timesheets', {
        body: {
          mode: 'all',
          start_date: startDate,
          end_date: endDate,
          dry_run: false,
        },
      });

      if (error) throw error;

      if (data.success) {
        setReprocessProgress(
          `✅ Finalizat: ${data.processed} intrări procesate, ${data.generated} timesheets generate`
        );
        toast.success(data.message);
        
        // ✅ Refresh soft cu query invalidation (fără reload brutal)
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['monthly-timesheets'] });
          queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
          queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
          queryClient.invalidateQueries({ queryKey: ['time-entries'] });
        }, 1000);
      } else {
        throw new Error(data.error || 'Eroare necunoscută');
      }
    } catch (error: any) {
      console.error('Reprocess error:', error);
      setReprocessProgress('❌ Eroare la re-procesare');
      toast.error(error.message || 'Eroare la re-procesarea datelor');
    } finally {
      setTimeout(() => {
        setIsReprocessing(false);
        setReprocessProgress('');
      }, 3000);
    }
  };

  return (
    <AdminLayout title="Timesheet - Payroll">
      <div className="container mx-auto p-6 max-w-7xl space-y-4">
        {/* Header with Search and Export */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 w-full sm:w-auto">
                <Input
                  placeholder="Căutați angajat după nume sau poziție..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium whitespace-nowrap">
                  {filteredEmployees.length} din {employeeData.length} angajați
                </div>
                <TimeEntryReprocessButton />
                <PayrollExportDialog 
                  allTimesheets={allTimesheets || []}
                  employees={employeeData.map(e => ({
                    id: e.userId,
                    name: e.userName,
                    totalHours: e.totalHours
                  }))}
                  currentMonth={currentMonth}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Re-procesare Section */}
        <Collapsible
          open={isReprocessSectionOpen}
          onOpenChange={setIsReprocessSectionOpen}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Re-procesare Timesheets
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aplică fix timezone + reguli noi de pauză pentru toți angajații
                    </p>
                  </div>
                  {isReprocessSectionOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="border-t">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">
                      Interval de date
                    </label>
                    <SimpleDateRangePicker
                      selected={dateRange}
                      onSelect={(range) => range && setDateRange(range)}
                    />
                  </div>

                  <Button
                    onClick={handleReprocess}
                    disabled={isReprocessing || !dateRange.from || !dateRange.to}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                    {isReprocessing ? 'Procesare...' : 'Re-procesează Date'}
                  </Button>
                </div>

                {reprocessProgress && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm font-mono">{reprocessProgress}</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Employee List */}
        {loadingUsers || loadingTimesheets ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Se încarcă datele...</p>
            </CardContent>
          </Card>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                Nu există angajați cu ore în această perioadă
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredEmployees.map((employee) => {
              const isExpanded = expandedEmployees.has(employee.userId);
              
              return (
                <Card key={employee.userId} className="overflow-hidden">
                  {/* Employee Header */}
                  <button
                    onClick={() => toggleEmployee(employee.userId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <User className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <div className="font-semibold text-lg">{employee.userName}</div>
                        <Badge variant="secondary" className="mt-1">
                          {employee.position}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4" />
                        <span className="font-bold text-lg">{formatHours(employee.totalHours)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        <span>{employee.daysWorked} zile</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <CardContent className="border-t bg-muted/20 p-6 space-y-6">
                      {/* Monthly Summary */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <CalendarIcon className="h-5 w-5" />
                          <h3 className="font-semibold text-lg">Sumar lunar</h3>
                          <div className="ml-auto">
                            <span className="text-sm font-medium">Total: </span>
                            <span className="text-lg font-bold text-primary">
                              {formatHours(employee.totalHours)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                          {/* Zi */}
                          <Card className={cn("p-3", employee.hoursByType.regular > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <Sun className="h-5 w-5 text-yellow-500" />
                              <div className="text-xs text-muted-foreground">Zi</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.regular)}</div>
                            </div>
                          </Card>

                          {/* Noapte */}
                          <Card className={cn("p-3", employee.hoursByType.night > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <Moon className="h-5 w-5 text-blue-500" />
                              <div className="text-xs text-muted-foreground">Noapte</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.night)}</div>
                            </div>
                          </Card>

                          {/* Sâmbătă */}
                          <Card className={cn("p-3", employee.hoursByType.saturday > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <CalendarIcon className="h-5 w-5 text-orange-500" />
                              <div className="text-xs text-muted-foreground">Sâmbătă</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.saturday)}</div>
                            </div>
                          </Card>

                          {/* Dum/Sârb */}
                          <Card className={cn("p-3", (employee.hoursByType.sunday + employee.hoursByType.holiday) > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <CalendarIcon className="h-5 w-5 text-red-500" />
                              <div className="text-xs text-muted-foreground">Dum/Sârb</div>
                              <div className="font-bold">
                                {formatHours(employee.hoursByType.sunday + employee.hoursByType.holiday)}
                              </div>
                            </div>
                          </Card>

                          {/* Pasager */}
                          <Card className={cn("p-3", employee.hoursByType.passenger > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <Users className="h-5 w-5 text-purple-500" />
                              <div className="text-xs text-muted-foreground">Pasager</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.passenger)}</div>
                            </div>
                          </Card>

                          {/* Condus */}
                          <Card className={cn("p-3", employee.hoursByType.driving > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <Truck className="h-5 w-5 text-green-500" />
                              <div className="text-xs text-muted-foreground">Condus</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.driving)}</div>
                            </div>
                          </Card>

                          {/* Utilaj */}
                          <Card className={cn("p-3", employee.hoursByType.equipment > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <Wrench className="h-5 w-5 text-gray-500" />
                              <div className="text-xs text-muted-foreground">Utilaj</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.equipment)}</div>
                            </div>
                          </Card>

                          {/* CO */}
                          <Card className={cn("p-3", employee.hoursByType.leave > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <Briefcase className="h-5 w-5 text-indigo-500" />
                              <div className="text-xs text-muted-foreground">CO</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.leave)}</div>
                            </div>
                          </Card>

                          {/* CM */}
                          <Card className={cn("p-3", employee.hoursByType.medical_leave > 0 && "border-primary")}>
                            <div className="flex flex-col items-center gap-1">
                              <HeartPulse className="h-5 w-5 text-pink-500" />
                              <div className="text-xs text-muted-foreground">CM</div>
                              <div className="font-bold">{formatHours(employee.hoursByType.medical_leave)}</div>
                            </div>
                          </Card>
                        </div>
                      </div>

                      {/* Detailed Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead className="text-center">Zi</TableHead>
                              <TableHead className="text-center">Noapte</TableHead>
                              <TableHead className="text-center">Sâm</TableHead>
                              <TableHead className="text-center">Dum</TableHead>
                              <TableHead className="text-center">Sârb</TableHead>
                              <TableHead className="text-center">Pasager</TableHead>
                              <TableHead className="text-center">Condus</TableHead>
                              <TableHead className="text-center">Utilaj</TableHead>
                              <TableHead className="text-center">CO</TableHead>
                              <TableHead className="text-center">CM</TableHead>
                              <TableHead>Observații</TableHead>
                              <TableHead className="text-center font-bold">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {employee.timesheets.map((ts) => {
                              const total = ts.hours_regular + ts.hours_night + ts.hours_saturday + 
                                          ts.hours_sunday + ts.hours_holiday + ts.hours_passenger + 
                                          ts.hours_driving + ts.hours_equipment + ts.hours_leave + 
                                          ts.hours_medical_leave;
                              
                              return (
                                <TableRow key={ts.id} className={getRowBackground(ts.work_date)}>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      <span>{format(new Date(ts.work_date), 'EEEE', { locale: ro })}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(ts.work_date), 'dd.MM')}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_regular > 0 ? formatHours(ts.hours_regular) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_night > 0 ? formatHours(ts.hours_night) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_saturday > 0 ? formatHours(ts.hours_saturday) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_sunday > 0 ? formatHours(ts.hours_sunday) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_holiday > 0 ? formatHours(ts.hours_holiday) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_passenger > 0 ? formatHours(ts.hours_passenger) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_driving > 0 ? formatHours(ts.hours_driving) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_equipment > 0 ? formatHours(ts.hours_equipment) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_leave > 0 ? formatHours(ts.hours_leave) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {ts.hours_medical_leave > 0 ? formatHours(ts.hours_medical_leave) : '-'}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {ts.notes || 'Observații...'}
                                  </TableCell>
                                  <TableCell className="text-center font-bold">
                                    {formatHours(total)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Timesheet;
