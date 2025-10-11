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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfMonth, endOfMonth, format, startOfWeek, addDays } from "date-fns";
import { ro } from "date-fns/locale";
import { User, ChevronDown, ChevronUp, Sun, Moon, Calendar as CalendarIcon, Users, Truck, Wrench, Briefcase, HeartPulse, TrendingUp, Clock, RefreshCw, Check, X, Info, ClipboardCheck, FileText } from "lucide-react";
import { DailyTimesheet } from "@/hooks/useDailyTimesheets";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { cn } from "@/lib/utils";
import { PayrollExportDialog } from "@/components/PayrollExportDialog";
import { PayrollImportDialog } from "@/components/PayrollImportDialog";
import { SimpleDateRangePicker } from "@/components/ui/simple-date-range-picker";
import { toast } from "sonner";
import { TimeEntryReprocessButton } from "@/components/TimeEntryReprocessButton";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { calculateCalendarView } from "@/lib/calendarViewUtils";
import { TeamTimeApprovalManager } from "@/components/TeamTimeApprovalManager";
import { TimesheetHistoryManager } from "@/components/TimesheetHistoryManager";

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
  
  // ✅ Editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // ✅ Tab state
  const [activeTab, setActiveTab] = useState<'fisePontaj' | 'verificare' | 'istoric'>('fisePontaj');
  
  // ✅ State pentru Verificare Pontaje
  const [selectedWeek] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  
  const queryClient = useQueryClient();

  // Query pentru pontaje pending count
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-approvals-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending_review');
      
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Query pentru echipe disponibile
  const { data: availableTeams } = useQuery({
    queryKey: ['available-teams'],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_schedules')
        .select('team_id')
        .order('team_id');
      
      return new Set(data?.map(s => s.team_id) || []);
    },
  });

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
  const { data: allTimesheets, isLoading: loadingTimesheets } = useQuery({
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

  // ✅ Mutation pentru editare timesheet
  const updateTimesheet = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: number | string }) => {
      // Validare doar pentru câmpuri numerice
      if (typeof value === 'number') {
        if (value < 0) {
          throw new Error('Orele nu pot fi negative');
        }
        if (value > 24) {
          throw new Error('Orele nu pot depăși 24h pe zi');
        }
      }

      const { error } = await supabase
        .from('daily_timesheets')
        .update({ 
          [field]: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Audit log
      await supabase.rpc('log_sensitive_data_access', {
        _action: 'update_timesheet',
        _resource_type: 'daily_timesheets',
        _resource_id: id,
        _details: {
          field,
          new_value: value,
          reason: 'Manual correction by admin'
        }
      });

      return { id, field, value };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets(monthStart) });
      toast.success('✅ Timesheet actualizat');
      setEditingCell(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la salvare');
    }
  });

  const handleCellClick = (rowId: string, field: string, currentValue: number | string) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue?.toString() || '');
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    
    // Detectează dacă e câmp numeric sau string
    const isNumericField = editingCell.field.startsWith('hours_');
    
    if (isNumericField) {
      const numValue = parseFloat(editValue);
      if (isNaN(numValue)) {
        toast.error('Valoare invalidă');
        return;
      }
      updateTimesheet.mutate({
        id: editingCell.rowId,
        field: editingCell.field,
        value: numValue
      });
    } else {
      // String field (ex: notes)
      updateTimesheet.mutate({
        id: editingCell.rowId,
        field: editingCell.field,
        value: editValue
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
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
        
        // ✅ Invalidare imediată DUPĂ success confirm
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets(monthStart) }),
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timeEntries() }),
          queryClient.invalidateQueries({ queryKey: ['users-with-roles-batched'] })
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
                <PayrollImportDialog 
                  onImportComplete={() => {
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets(monthStart) });
                  }}
                />
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
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold mb-2">Regula de Noapte (00:00-06:00)</p>
                      <p className="text-sm mb-2">
                        <strong>Mod Salarizare (implicit):</strong> Orele între 00:00-06:00 sunt alocate zilei precedente conform politicii companiei pentru raportare salarială.
                      </p>
                      <p className="text-sm">
                        <strong>Mod Calendaristic:</strong> Orele sunt afișate pe ziua calendaristică efectivă, fără mutare. Folosit doar pentru vizualizare.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              {viewMode === 'calendar' && (
                <Badge variant="secondary" className="gap-2">
                  <CalendarIcon className="h-3 w-3" />
                  Vizualizare calendaristică (nu afectează raportarea)
                </Badge>
              )}
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
                                  {/* ✅ Celule editabile pentru ore */}
                                  {['hours_regular', 'hours_night', 'hours_saturday', 'hours_sunday', 'hours_holiday', 
                                    'hours_passenger', 'hours_driving', 'hours_equipment', 'hours_leave', 'hours_medical_leave'].map(field => {
                                    const fieldValue = ts[field as keyof DailyTimesheet] as number;
                                    const isEditing = editingCell?.rowId === ts.id && editingCell?.field === field;
                                    
                                    return (
                                      <TableCell 
                                        key={field}
                                        className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => !isEditing && handleCellClick(ts.id, field, fieldValue)}
                                      >
                                        {isEditing ? (
                                          <div className="flex items-center gap-1 justify-center">
                                            <Input
                                              type="number"
                                              step="0.5"
                                              min="0"
                                              max="24"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="w-16 h-8 text-center"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') handleCancelEdit();
                                              }}
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                                              <Check className="h-4 w-4 text-green-600" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEdit}>
                                              <X className="h-4 w-4 text-red-600" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <span className="hover:underline">
                                            {fieldValue > 0 ? formatHours(fieldValue) : '-'}
                                          </span>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell 
                                    className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => {
                                      const isEditing = editingCell?.rowId === ts.id && editingCell?.field === 'notes';
                                      if (!isEditing) handleCellClick(ts.id, 'notes', ts.notes || '');
                                    }}
                                  >
                                    {editingCell?.rowId === ts.id && editingCell?.field === 'notes' ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="h-8 text-sm"
                                          autoFocus
                                          placeholder="Observații..."
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveEdit();
                                            if (e.key === 'Escape') handleCancelEdit();
                                          }}
                                        />
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                                          <Check className="h-4 w-4 text-green-600" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEdit}>
                                          <X className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="hover:underline">
                                        {ts.notes || 'Observații...'}
                                      </span>
                                    )}
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
  );
};

export default Timesheet;
