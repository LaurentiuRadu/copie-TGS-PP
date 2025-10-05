import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Loader2 } from 'lucide-react';
import { format, differenceInDays, startOfDay, endOfDay, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { exportToExcel, exportToCSV } from '@/lib/exportUtils';
import { toast } from '@/hooks/use-toast';
import { SimpleDateRangePicker, type DateRange } from '@/components/ui/simple-date-range-picker';

interface CustomPeriodExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prepareExportDataFromEntries: (entries: any[]) => any[];
}

interface Employee {
  id: string;
  full_name: string;
  username: string;
}

export function CustomPeriodExportDialog({
  open,
  onOpenChange,
  prepareExportDataFromEntries
}: CustomPeriodExportDialogProps) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [previewCount, setPreviewCount] = useState<number>(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'employee');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
      }

      const employeeIds = roles.map((r) => r.user_id);

      if (employeeIds.length === 0) {
        setAllEmployees([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', employeeIds)
        .order('full_name');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      setAllEmployees(profiles || []);
    };

    if (open) {
      fetchEmployees();
    }
  }, [open]);

  // Fetch preview count when filters change
  useEffect(() => {
    const fetchPreviewCount = async () => {
      if (!dateRange?.from || !dateRange?.to) {
        setPreviewCount(0);
        return;
      }

      setIsLoadingPreview(true);
      try {
        let query = supabase
          .from('time_entries')
          .select('*', { count: 'exact', head: true })
          .gte('clock_in_time', startOfDay(dateRange.from).toISOString())
          .lt('clock_in_time', addDays(endOfDay(dateRange.to), 1).toISOString());

        // Filter by selected employees if not all
        if (selectedEmployees.length > 0 && selectedEmployees.length < allEmployees.length) {
          query = query.in('user_id', selectedEmployees);
        }

        const { count, error } = await query;

        if (error) throw error;
        setPreviewCount(count || 0);
      } catch (error) {
        console.error('Preview count error:', error);
        setPreviewCount(0);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreviewCount();
  }, [dateRange, selectedEmployees, allEmployees.length]);

  // Validate date range (max 31 days)
  const isValidDateRange = () => {
    if (!dateRange?.from || !dateRange?.to) return false;
    const days = differenceInDays(dateRange.to, dateRange.from);
    return days >= 0 && days <= 31;
  };

  const getDaysDifference = () => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInDays(dateRange.to, dateRange.from);
  };

  // Toggle all employees
  const handleToggleAll = () => {
    if (selectedEmployees.length === allEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(allEmployees.map((e) => e.id));
    }
  };

  // Toggle single employee
  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  // Export logic
  const handleExport = async (exportFormat: 'excel' | 'csv') => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: 'Eroare',
        description: 'Te rugăm să selectezi un interval de date.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidDateRange()) {
      toast({
        title: 'Eroare',
        description: 'Intervalul maxim este de 31 zile.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      // First, fetch time entries
      let entriesQuery = supabase
        .from('time_entries')
        .select(`
          *,
          time_entry_segments(*)
        `)
        .gte('clock_in_time', startOfDay(dateRange.from).toISOString())
        .lt('clock_in_time', addDays(endOfDay(dateRange.to), 1).toISOString())
        .order('clock_in_time', { ascending: true });

      // Filter by employees if specific selection
      if (selectedEmployees.length > 0 && selectedEmployees.length < allEmployees.length) {
        entriesQuery = entriesQuery.in('user_id', selectedEmployees);
      }

      const { data: timeEntries, error: entriesError } = await entriesQuery;

      if (entriesError) throw entriesError;

      if (!timeEntries || timeEntries.length === 0) {
        toast({
          title: 'Nicio înregistrare',
          description: 'Nu există pontaje în această perioadă.',
        });
        return;
      }

      // Fetch profiles for these users
      const userIds = [...new Set(timeEntries.map(entry => entry.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles to entries
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const data = timeEntries.map(entry => ({
        ...entry,
        profiles: profilesMap.get(entry.user_id)
      }));

      if (!data || data.length === 0) {
        toast({
          title: 'Nicio înregistrare',
          description: 'Nu există pontaje în această perioadă.',
        });
        return;
      }

      // Prepare export data
      const exportData = prepareExportDataFromEntries(data);

      if (!exportData || exportData.length === 0) {
        toast({
          title: 'Eroare la procesare',
          description: 'Nu s-au putut procesa datele pentru export.',
          variant: 'destructive',
        });
        return;
      }

      // Generate filename
      const fromFormatted = format(dateRange.from, 'dd_MMM', { locale: ro });
      const toFormatted = format(dateRange.to, 'dd_MMM_yyyy', { locale: ro });
      const filename = `Pontaje_${fromFormatted}_-_${toFormatted}`;

      // Export based on format
      if (exportFormat === 'excel') {
        exportToExcel(exportData, filename);
      } else if (exportFormat === 'csv') {
        exportToCSV(exportData, filename);
      }

      // Count unique employees in exported data
      const uniqueEmployees = new Set(data.map(entry => entry.user_id));
      const actualEmployeeCount = uniqueEmployees.size;

      toast({
        title: 'Export realizat cu succes',
        description: `${data.length} pontaje pentru ${actualEmployeeCount} angajați.`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error?.message || 'Eroare necunoscută';
      toast({
        title: 'Eroare la export',
        description: `${errorMessage}. Te rugăm să încerci din nou.`,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const daysDiff = getDaysDifference();
  const isRangeValid = isValidDateRange();
  const canExport = dateRange?.from && dateRange?.to && isRangeValid && !isExporting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Perioadă Personalizată</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range Picker */}
          <div className="space-y-2">
            <Label>Interval de Date (max. 31 zile)</Label>
            <div className="flex justify-center">
              <SimpleDateRangePicker
                value={dateRange}
                onChange={setDateRange}
                locale={ro}
                className="rounded-md border p-3"
                numberOfMonths={2}
              />
            </div>
            {dateRange?.from && dateRange?.to && (
              <div className="flex items-center justify-center gap-2">
                {isRangeValid ? (
                  <Badge variant="outline">
                    {daysDiff + 1} {daysDiff === 0 ? 'zi' : 'zile'} selectate
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    ⚠️ Interval prea mare ({daysDiff + 1} zile, max 31)
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Employee Multi-select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Angajați</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                disabled={allEmployees.length === 0}
              >
                {selectedEmployees.length === allEmployees.length ? 'Deselectează' : 'Selectează'} tot
              </Button>
            </div>

            {allEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nu există angajați disponibili
              </p>
            ) : (
              <>
                <Badge variant="secondary">
                  {selectedEmployees.length === 0 || selectedEmployees.length === allEmployees.length
                    ? `Toți angajații (${allEmployees.length})`
                    : `${selectedEmployees.length} din ${allEmployees.length} selectați`}
                </Badge>

                <ScrollArea className="h-[200px] rounded-md border p-4">
                  <div className="space-y-3">
                    {allEmployees.map((employee) => (
                      <div key={employee.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={employee.id}
                          checked={
                            selectedEmployees.length === 0 ||
                            selectedEmployees.includes(employee.id)
                          }
                          onCheckedChange={() => handleToggleEmployee(employee.id)}
                        />
                        <Label
                          htmlFor={employee.id}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {employee.full_name}{' '}
                          <span className="text-muted-foreground">({employee.username})</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          {/* Preview Counter */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Preview:</span>
              {isLoadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se calculează...
                </div>
              ) : (
                <Badge variant="default">
                  {previewCount} {previewCount === 1 ? 'pontaj găsit' : 'pontaje găsite'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Anulează
          </Button>
          <Button
            onClick={() => handleExport('csv')}
            disabled={!canExport}
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('excel')}
            disabled={!canExport}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
