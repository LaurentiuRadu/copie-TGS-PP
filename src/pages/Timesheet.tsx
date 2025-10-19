import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ro } from "date-fns/locale";
import { User, ChevronDown, ChevronUp, Sun, Moon, Calendar as CalendarIcon, Users, Truck, Wrench, Briefcase, HeartPulse, TrendingUp, Clock, RefreshCw, Info, Lock, AlertCircle } from "lucide-react";
import { DailyTimesheet } from "@/hooks/useDailyTimesheets";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { cn } from "@/lib/utils";
import { PayrollExportDialog } from "@/components/PayrollExportDialog";
import { SimpleDateRangePicker } from "@/components/ui/simple-date-range-picker";
import { toast } from "sonner";
import { TimeEntryReprocessButton } from "@/components/TimeEntryReprocessButton";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { calculateCalendarView } from "@/lib/calendarViewUtils";

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
  
  // ✅ View mode: 'payroll' (default) or 'calendar'
  const [viewMode, setViewMode] = useState<'payroll' | 'calendar'>('payroll');
  
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // ✅ Optional: Fetch user roles (won't block UI if fails)
  const { data: usersWithRoles } = useQuery({
    queryKey: ['users-with-roles-batched'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          username, 
          full_name,
          user_roles(role)
        `)
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }
      
      // Transform to include role directly
      return data.map((user: any) => ({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.user_roles?.[0]?.role || 'employee'
      }));
    },
  });

  // ✅ Fetch all timesheets for the current month (primary data source)
  // 🔄 Forțăm reîncărcarea pentru a evita discrepanțe de cache după reprocessing
  const { data: allTimesheets, isLoading: loadingTimesheets, refetch: refetchTimesheets } = useQuery({
    queryKey: QUERY_KEYS.dailyTimesheets(monthStart),
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
    staleTime: 0, // ✅ Datele devin stale imediat
    refetchOnMount: 'always', // ✅ Refetch la fiecare mount
    refetchOnWindowFocus: true, // ✅ Refetch când utilizatorul revine la tab
    refetchOnReconnect: true, // ✅ Refetch când se reconectează
  });

  // ✅ Fetch time_entries for calendar view calculation
  const { data: timeEntries } = useQuery({
    queryKey: ['time-entries-for-calendar', monthStart],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in_time, clock_out_time')
        .gte('clock_in_time', monthStart.toISOString())
        .lte('clock_in_time', monthEnd.toISOString())
        .not('clock_out_time', 'is', null)
        .order('clock_in_time', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately to avoid join issues
      const userIds = [...new Set(entries.map(e => e.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Merge profiles into entries
      return entries.map(entry => ({
        ...entry,
        profiles: profiles?.find(p => p.id === entry.user_id)
      }));
    },
    enabled: viewMode === 'calendar', // Only fetch when in calendar mode
  });

  // ✅ Calculate calendar view from time_entries
  const calendarTimesheets = useMemo(() => {
    if (viewMode !== 'calendar' || !timeEntries) return [];
    return calculateCalendarView(timeEntries, monthStart, monthEnd);
  }, [viewMode, timeEntries, monthStart, monthEnd]);

  // ✅ Process employee data FROM timesheets (not dependent on usersWithRoles)
  const employeeData: EmployeeTimesheetData[] = useMemo(() => {
    // Use calendar view if enabled, otherwise use payroll view
    const sourceTimesheets = viewMode === 'calendar' ? calendarTimesheets : allTimesheets;
    if (!sourceTimesheets) return [];

    // Group timesheets by employee_id
    const employeeMap = new Map<string, DailyTimesheet[]>();
    
    sourceTimesheets.forEach(ts => {
      if (!employeeMap.has(ts.employee_id)) {
        employeeMap.set(ts.employee_id, []);
      }
      employeeMap.get(ts.employee_id)!.push(ts);
    });

    // Convert to EmployeeTimesheetData array
    return Array.from(employeeMap.entries()).map(([employeeId, userTimesheets]) => {
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

      // Get employee name from first timesheet's profile data
      const profile = userTimesheets[0]?.profiles;
      const userName = profile?.full_name || profile?.username || 'Necunoscut';

      // Try to get role from usersWithRoles, fallback to 'Angajat'
      const userRole = usersWithRoles?.find(u => u.id === employeeId)?.role || 'employee';
      const position = userRole === 'admin' ? 'Administrator' : 'Angajat';

      return {
        userId: employeeId,
        userName,
        position,
        totalHours,
        daysWorked,
        timesheets: userTimesheets,
        hoursByType,
      };
    })
    .filter(emp => emp.totalHours > 0) // Only show employees with hours
    .sort((a, b) => a.userName.localeCompare(b.userName)); // Sort by name
  }, [viewMode, calendarTimesheets, allTimesheets, usersWithRoles]);

  // ✅ Extend employee timesheets cu 7 zile consecutive (X-3 → X+3)
  // IMPORTANT: Citim direct din allTimesheets (daily_timesheets DB) - sursa primară pentru date APROBATE
  const employeeDataWithFullWeek = useMemo(() => {
    const today = new Date();
    
    // Calculăm intervalul de 7 zile
    const daysToShow = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - 3 + i);
      return format(date, 'yyyy-MM-dd');
    });

    return employeeData.map(employee => {
      // ✅ CRITICAL: Căutăm în allTimesheets (DB) în loc de employee.timesheets
      const filledTimesheets = daysToShow.map(dateStr => {
        // Căutăm în allTimesheets (sursa primară din DB pentru date APROBATE)
        const existing = allTimesheets?.find(ts => 
          ts.employee_id === employee.userId && 
          ts.work_date === dateStr
        );
        
        if (existing) {
          return existing; // Date REALE din daily_timesheets (APROBATE)
        } else {
          // Placeholder DOAR pentru zile fără date aprobate în DB
          return {
            id: `placeholder-${employee.userId}-${dateStr}`,
            employee_id: employee.userId,
            work_date: dateStr,
            hours_regular: 0,
            hours_night: 0,
            hours_saturday: 0,
            hours_sunday: 0,
            hours_holiday: 0,
            hours_passenger: 0,
            hours_driving: 0,
            hours_equipment: 0,
            hours_leave: 0,
            hours_medical_leave: 0,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profiles: employee.timesheets[0]?.profiles || {
              id: employee.userId,
              username: null,
              full_name: null
            }
          } as DailyTimesheet;
        }
      });

      return {
        ...employee,
        timesheets: filledTimesheets.sort((a, b) => 
          new Date(a.work_date).getTime() - new Date(b.work_date).getTime()
        )
      };
    });
  }, [employeeData, allTimesheets]); // ✅ Adăugat allTimesheets în dependencies

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employeeDataWithFullWeek;
    
    const query = searchQuery.toLowerCase();
    return employeeDataWithFullWeek.filter(emp => 
      emp.userName.toLowerCase().includes(query) ||
      emp.position.toLowerCase().includes(query)
    );
  }, [employeeDataWithFullWeek, searchQuery]);

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

  const getRowBackground = (dateStr: string, isPlaceholder: boolean = false) => {
    if (isPlaceholder) {
      return 'bg-gray-100 dark:bg-gray-900/30 opacity-50';
    }
    const dayOfWeek = getDayOfWeek(dateStr);
    if (dayOfWeek === 'duminică') return 'bg-red-50 dark:bg-red-950/20';
    if (dayOfWeek === 'sâmbătă') return 'bg-yellow-50 dark:bg-yellow-950/20';
    return 'bg-green-50 dark:bg-green-950/20';
  };

  // ❌ REMOVED: Editing functionality (page is READ-ONLY)
  // All timesheet editing is now done in TimesheetVerificare.tsx

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

      const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
        body: {
          mode: 'date_range',
          start_date: startDate,
          end_date: endDate,
          batch_size: 100
        },
      });

      if (error) throw error;

      if (data.success) {
        setReprocessProgress(
          `✅ Finalizat: ${data.processed} intrări procesate, ${data.generated} timesheets generate`
        );
        toast.success(data.message);
        
        // ✅ Invalidare imediată DUPĂ success confirm + refetch explicit
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets(monthStart) }),
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timeEntries() }),
          queryClient.invalidateQueries({ queryKey: ['users-with-roles-batched'] }),
          queryClient.refetchQueries({ queryKey: QUERY_KEYS.dailyTimesheets(monthStart) }) // ✅ Forțăm refetch instant
        ]);
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
    <div className="w-full p-4 md:p-6 space-y-4">
        {/* Header with Search and Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Timesheet General - Pontaje Aprobate</CardTitle>
              
              {/* 🆕 Badge compact cu tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-400 dark:bg-blue-950/30 dark:text-blue-300 cursor-help">
                      <Lock className="h-3 w-3 mr-1" />
                      Doar aprobate
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm">
                    <p className="text-sm">
                      <strong>Notă:</strong> Această pagină afișează <strong>doar pontajele aprobate</strong> de administrator.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pentru corecturi sau modificări, accesați{' '}
                      <a href="/timesheet-verificare" className="underline font-medium hover:text-blue-600">
                        Verificare Pontaje
                      </a>.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 🆕 Badge compact pentru octombrie 2025 */}
              {format(currentMonth, 'yyyy-MM') === '2025-10' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-400 dark:bg-amber-950/30 dark:text-amber-300 cursor-help">
                        <Info className="h-3 w-3 mr-1" />
                        📅 Octombrie 2025*
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700">
                      <p className="text-sm text-amber-900 dark:text-amber-100">
                        📅 <strong>Notă:</strong> Datele pentru perioada 01-12.10.2025 sunt gestionate în Payroll extern.
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Sistemul automatizat de pontaj este activ începând cu <strong>13.10.2025</strong>.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <CardDescription>
              Ore lucrate pe angajați și categorii (doar pontaje aprobate)
            </CardDescription>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
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
                
                {/* 🆕 Buton Reîncarcă Datele */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchTimesheets()}
                        className="gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reîncarcă
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Reîncarcă datele din backend</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TimeEntryReprocessButton />
                <PayrollExportDialog
                  allTimesheets={allTimesheets || []}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* View Mode Toggle with Night Rule Explanation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="view-mode"
                    checked={viewMode === 'calendar'}
                    onCheckedChange={(checked) => setViewMode(checked ? 'calendar' : 'payroll')}
                  />
                  <Label htmlFor="view-mode" className="cursor-pointer">
                    {viewMode === 'payroll' ? 'Mod Salarizare' : 'Mod Calendaristic'}
                  </Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 cursor-help hover:bg-primary/20 transition-colors">
                        <Info className="h-4 w-4 text-primary" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-md">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">📊 Diferență între moduri</p>
                        <div className="text-xs space-y-1">
                          <p><strong>Mod Salarizare (implicit):</strong> Afișează datele aprobate din backend, calculate prin segmentare automată. Fiecare segment este atribuit zilei sale calendaristice corecte.</p>
                          <p><strong>Mod Calendaristic:</strong> Vizualizare simplificată bazată pe pontaje brute (clock_in/clock_out). Folosit doar pentru referință, nu afectează raportarea oficială.</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="flex items-center gap-2">
                {viewMode === 'calendar' ? (
                  <Badge variant="secondary" className="gap-2">
                    <CalendarIcon className="h-3 w-3" />
                    Vizualizare calendaristică (nu afectează raportarea)
                  </Badge>
                ) : (
                  <Badge variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
                    <Lock className="h-3 w-3" />
                    Sursă: Date aprobate (backend)
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
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
        {loadingTimesheets ? (
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
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <TableHead className="text-center cursor-help">Săm</TableHead>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs">
                                    <p className="text-xs">Afișează orele Sâmbătă 06:00 → Duminică 05:59:59 (agregate)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <TableHead className="text-center cursor-help">Dum</TableHead>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs">
                                    <p className="text-xs">Afișează orele Duminică 06:00 → 23:59:59 (agregate)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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
                            {(() => {
                              // ✅ Creăm index pentru nextDay lookup
                              const timesheetMap = new Map(employee.timesheets.map(t => [t.work_date, t]));
                              
                              return employee.timesheets.map((ts, idx) => {
                                // ✅ Calculăm ziua următoare pentru lookup
                                const currentDate = new Date(ts.work_date + 'T00:00:00Z');
                                const nextDate = new Date(currentDate);
                                nextDate.setUTCDate(nextDate.getUTCDate() + 1);
                                const nextDateStr = format(nextDate, 'yyyy-MM-dd');
                                const nextDayTimesheet = timesheetMap.get(nextDateStr);
                                
                                // ✅ Determinăm ziua săptămânii (0=Duminică, 6=Sâmbătă)
                                const dayOfWeek = currentDate.getUTCDay();
                                
                                // ✅ Calculăm weekend "ancorat pe rând"
                                let displayedSaturday = 0;
                                let displayedSunday = 0;
                                
                                if (dayOfWeek === 6) { // Sâmbătă
                                  displayedSaturday = (ts.hours_saturday || 0) + (nextDayTimesheet?.hours_saturday || 0);
                                  displayedSunday = 0;
                                } else if (dayOfWeek === 0) { // Duminică
                                  displayedSaturday = 0; // Orele Dum 00:00-06:00 sunt deja la Sâmbătă
                                  displayedSunday = ts.hours_sunday || 0;
                                } else {
                                  displayedSaturday = 0;
                                  displayedSunday = 0;
                                }
                                
                                // ✅ Recalculăm totalul cu valorile AFIȘATE
                                const total = ts.hours_regular + ts.hours_night + displayedSaturday + displayedSunday + ts.hours_holiday + 
                                            ts.hours_passenger + ts.hours_driving + ts.hours_equipment + 
                                            ts.hours_leave + ts.hours_medical_leave;
                                
                                const isPlaceholder = ts.id.startsWith('placeholder-');
                                
                                return (
                                  <TableRow key={ts.id} className={cn(
                                    getRowBackground(ts.work_date, isPlaceholder),
                                    "hover:bg-muted/80 transition-colors"
                                  )}>
                                    <TableCell className="font-medium">
                                      <div className="flex flex-col">
                                        <span>{format(new Date(ts.work_date), 'EEEE', { locale: ro })}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(ts.work_date), 'dd.MM')}
                                        </span>
                                      </div>
                                    </TableCell>
                                    
                                    {/* Zi */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_regular > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_regular > 0 ? formatHours(ts.hours_regular) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Noapte */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_night > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_night > 0 ? formatHours(ts.hours_night) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* ✅ Săm (weekend ancorat) */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          displayedSaturday > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {displayedSaturday > 0 ? formatHours(displayedSaturday) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* ✅ Dum (weekend ancorat) */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          displayedSunday > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {displayedSunday > 0 ? formatHours(displayedSunday) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Sârb */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_holiday > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_holiday > 0 ? formatHours(ts.hours_holiday) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Pasager */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_passenger > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_passenger > 0 ? formatHours(ts.hours_passenger) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Condus */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_driving > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_driving > 0 ? formatHours(ts.hours_driving) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Utilaj */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_equipment > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_equipment > 0 ? formatHours(ts.hours_equipment) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* CO */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_leave > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_leave > 0 ? formatHours(ts.hours_leave) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* CM */}
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "rounded-full px-3 py-1.5 text-sm font-medium min-w-[48px]",
                                          ts.hours_medical_leave > 0 
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" 
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                                          isPlaceholder && "opacity-50 bg-gray-50 dark:bg-gray-900"
                                        )}
                                      >
                                        {ts.hours_medical_leave > 0 ? formatHours(ts.hours_medical_leave) : '0'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Observații */}
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-xs max-w-[150px] truncate",
                                          !ts.notes && "text-muted-foreground bg-gray-50 dark:bg-gray-900",
                                          isPlaceholder && "opacity-50"
                                        )}
                                      >
                                        {ts.notes || 'Fără observații'}
                                      </Badge>
                                    </TableCell>
                                    
                                    {/* Total (recalculat cu valori afișate) */}
                                    <TableCell className="text-center font-bold">
                                      {formatHours(total)}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
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
  );
};

export default Timesheet;
