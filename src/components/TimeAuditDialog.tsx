import { useState } from "react";
import { useForm } from "react-hook-form";
import { format, subDays } from "date-fns";
import { Search, Download, Copy, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AuditResponse {
  user: {
    id: string;
    username: string;
    full_name: string;
  };
  range: {
    start: string;
    end: string;
  };
  days: Array<{
    date: string;
    entries: Array<{
      id: string;
      clock_in: string;
      clock_out: string | null;
      duration_hours: number | null;
      status: string;
      notes: string | null;
    }>;
    entries_total_hours: number;
    timesheet: {
      hours_regular?: number;
      hours_night?: number;
      hours_saturday?: number;
      hours_sunday?: number;
      hours_holiday?: number;
      hours_passenger?: number;
      hours_driving?: number;
      hours_equipment?: number;
      total?: number;
      notes?: string | null;
    };
    delta: number;
    flags: string[];
  }>;
  summary: {
    total_entries_hours: number;
    total_timesheet_hours: number;
    total_delta: number;
    days_with_discrepancies: number;
    incomplete_entries: number;
    missing_timesheets: number;
  };
  csv_export: string;
}

export function TimeAuditDialog() {
  const [open, setOpen] = useState(false);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      username: '',
      start_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-time-audit', {
        body: {
          username: values.username,
          start_date: values.start_date,
          end_date: values.end_date,
        },
      });

      if (error) throw error;

      setAuditData(data);
      toast.success('Raport generat cu succes!');
    } catch (error: any) {
      console.error('Error generating audit:', error);
      toast.error(error.message || 'Eroare la generarea raportului');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!auditData?.csv_export) return;

    const blob = new Blob([auditData.csv_export], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${auditData.user.username}_${auditData.range.start}_${auditData.range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exportat cu succes!');
  };

  const copyJSON = () => {
    if (!auditData) return;

    navigator.clipboard.writeText(JSON.stringify(auditData, null, 2));
    toast.success('JSON copiat în clipboard!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Search className="h-4 w-4" />
          🔍 Audit Pontaje
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Pontaje vs Daily Timesheets</DialogTitle>
          <DialogDescription>
            Compară pontajele reale cu timesheets-urile agregate pentru a identifica discrepanțe
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="laurentiuradu" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Sfârșit</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Generare...' : 'Generează Raport'}
            </Button>
          </form>
        </Form>

        {/* Results */}
        {auditData && (
          <div className="space-y-4 mt-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {auditData.user.full_name} (@{auditData.user.username})
                </CardTitle>
                <CardDescription>
                  Interval: {auditData.range.start} → {auditData.range.end}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Sumar</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Ore Pontaje</p>
                  <p className="text-2xl font-bold">{auditData.summary.total_entries_hours}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Ore Timesheet</p>
                  <p className="text-2xl font-bold">{auditData.summary.total_timesheet_hours}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Diferență Totală</p>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      auditData.summary.total_delta === 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {auditData.summary.total_delta > 0 ? '+' : ''}
                    {auditData.summary.total_delta}h
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Zile cu Discrepanțe</p>
                  <p className="text-xl font-bold">{auditData.summary.days_with_discrepancies}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pontaje Incomplete</p>
                  <p className="text-xl font-bold">{auditData.summary.incomplete_entries}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timesheets Lipsă</p>
                  <p className="text-xl font-bold">{auditData.summary.missing_timesheets}</p>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pontaje (Intervale)</TableHead>
                    <TableHead className="text-right">Total Pontaje</TableHead>
                    <TableHead className="text-right">Total Timesheet</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditData.days.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">{day.date}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {day.entries.length === 0 && (
                            <span className="text-muted-foreground">Fără pontaje</span>
                          )}
                          {day.entries.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {format(new Date(entry.clock_in), 'HH:mm')} →{' '}
                              {entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '?'}
                              {entry.duration_hours !== null && ` (${entry.duration_hours.toFixed(2)}h)`}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {day.entries_total_hours.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {day.timesheet.total ? day.timesheet.total.toFixed(2) : '0.00'}h
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold',
                          day.delta === 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {day.delta > 0 ? '+' : ''}
                        {day.delta.toFixed(2)}h
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {day.flags.length === 0 && (
                            <Badge variant="outline" className="bg-green-100 dark:bg-green-950/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                          {day.flags.includes('discrepancy') && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Discrepanță
                            </Badge>
                          )}
                          {day.flags.includes('incomplete') && (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Incomplet
                            </Badge>
                          )}
                          {day.flags.includes('missing_timesheet') && (
                            <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950/30">
                              📋 Lipsă Timesheet
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <Button onClick={exportCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                📥 Export CSV
              </Button>
              <Button onClick={copyJSON} variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                📋 Copiază JSON
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
