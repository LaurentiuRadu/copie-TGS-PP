import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Pencil, Lock, AlertCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';

interface ApprovedEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string;
  approved_at: string;
  approved_by: string;
  approval_notes: string;
  was_edited_by_admin: boolean;
  original_clock_in_time: string | null;
  original_clock_out_time: string | null;
  profiles: {
    full_name: string;
    username: string;
  };
  approver_profile: {
    full_name: string;
    username: string;
  };
}

export function TimesheetHistoryManager() {
  const queryClient = useQueryClient();
  
  const [daysFilter, setDaysFilter] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyEdited, setShowOnlyEdited] = useState(false);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ApprovedEntry | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editReason, setEditReason] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);

  // Query pentru pontaje aprobate
  const { data: approvedEntries, isLoading } = useQuery({
    queryKey: ['approved-timesheet-history', daysFilter],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(daysFilter));
      
      // Step 1: Fetch time_entries WITHOUT nested join
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in_time, clock_out_time, approved_at, approved_by, approval_notes, was_edited_by_admin, original_clock_in_time, original_clock_out_time')
        .eq('approval_status', 'approved')
        .gte('approved_at', daysAgo.toISOString())
        .order('approved_at', { ascending: false });
      
      if (error) throw error;

      // Step 2: Extract unique user IDs (employees)
      const employeeIds = [...new Set(data.map((e: any) => e.user_id))];

      // Step 3: Fetch employee profiles separately
      const { data: employeeProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', employeeIds);

      // Step 4: Fetch approver profiles separately
      const approverIds = [...new Set(data.map((e: any) => e.approved_by).filter(Boolean))];
      const { data: approvers } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', approverIds);

      // Step 5: Merge all data in JavaScript
      return data.map((entry: any) => ({
        ...entry,
        profiles: employeeProfiles?.find((p: any) => p.id === entry.user_id) || { full_name: 'Unknown', username: 'unknown' },
        approver_profile: approvers?.find((a: any) => a.id === entry.approved_by) || null
      })) as ApprovedEntry[];
    },
    refetchInterval: 60000,
  });

  const filteredEntries = approvedEntries?.filter(entry => {
    const matchesSearch = entry.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.profiles.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEditFilter = showOnlyEdited ? entry.was_edited_by_admin : true;
    return matchesSearch && matchesEditFilter;
  });

  const handleExportExcel = () => {
    if (!filteredEntries || filteredEntries.length === 0) {
      toast.error('Nu există date de exportat');
      return;
    }

    // Prepare data pentru Excel
    const excelData = filteredEntries.map(entry => ({
      'Angajat': entry.profiles.full_name,
      'Username': entry.profiles.username,
      'Clock-In Original': entry.original_clock_in_time 
        ? format(new Date(entry.original_clock_in_time), 'dd.MM.yyyy HH:mm', { locale: ro })
        : '-',
      'Clock-Out Original': entry.original_clock_out_time
        ? format(new Date(entry.original_clock_out_time), 'dd.MM.yyyy HH:mm', { locale: ro })
        : '-',
      'Clock-In Curent': format(new Date(entry.clock_in_time), 'dd.MM.yyyy HH:mm', { locale: ro }),
      'Clock-Out Curent': format(new Date(entry.clock_out_time), 'dd.MM.yyyy HH:mm', { locale: ro }),
      'Editat': entry.was_edited_by_admin ? 'DA' : 'NU',
      'Ore Totale': ((new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60)).toFixed(2),
      'Aprobat De': entry.approver_profile?.full_name || '-',
      'Data Aprobare': format(new Date(entry.approved_at), 'dd.MM.yyyy HH:mm', { locale: ro }),
      'Note Admin': entry.approval_notes || '-',
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pontaje Aprobate');

    // Auto-size columns
    const colWidths = Object.keys(excelData[0]).map(key => ({
      wch: Math.max(key.length, 15),
    }));
    ws['!cols'] = colWidths;

    // Download
    const fileName = `Pontaje_Aprobate_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success(`✅ Export finalizat: ${fileName}`);
  };

  const handleOpenPasswordDialog = (entry: ApprovedEntry) => {
    // Verifică dacă pontajul este aprobat (read-only)
    if (entry.approved_at) {
      toast.error('❌ Pontajul este aprobat și nu poate fi editat');
      return;
    }
    
    setSelectedEntry(entry);
    setAdminPassword('');
    setPasswordVerified(false);
    setPasswordDialogOpen(true);
  };

  // Verificare parolă admin
  const verifyPassword = useMutation({
    mutationFn: async (password: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Nu ești autentificat');

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (error) throw new Error('Parolă incorectă');
      
      return true;
    },
    onSuccess: () => {
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
      
      if (selectedEntry) {
        setEditClockIn(format(new Date(selectedEntry.clock_in_time), "yyyy-MM-dd'T'HH:mm"));
        setEditClockOut(format(new Date(selectedEntry.clock_out_time), "yyyy-MM-dd'T'HH:mm"));
        setEditReason('');
        setEditDialogOpen(true);
      }
      
      toast.success('✅ Parolă verificată - poți edita pontajul');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Parolă incorectă');
    },
  });

  const editHistoricalEntry = useMutation({
    mutationFn: async ({
      entryId,
      clockIn,
      clockOut,
      reason,
    }: {
      entryId: string;
      clockIn: string;
      clockOut: string;
      reason: string;
    }) => {
      const clockInDate = new Date(clockIn);
      const clockOutDate = new Date(clockOut);
      
      if (clockOutDate <= clockInDate) {
        throw new Error('Ora de ieșire trebuie să fie după ora de intrare');
      }
      
      const diffHours = (clockOutDate.getTime() - clockInDate.getTime()) / 3600000;
      if (diffHours > 24) {
        throw new Error('Durata nu poate depăși 24 de ore');
      }
      
      if (!reason.trim()) {
        throw new Error('Motivul re-editării este obligatoriu');
      }

      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          clock_in_time: clockInDate.toISOString(),
          clock_out_time: clockOutDate.toISOString(),
          approval_notes: `[RE-EDITAT] ${reason}`,
          approved_at: new Date().toISOString(),
          needs_reprocessing: false, // ✅ Auto-clear din "Pontaje Suspicioase"
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      const { error: funcError } = await supabase.functions.invoke('calculate-time-segments', {
        body: { time_entry_id: entryId },
      });

      if (funcError) {
        console.warn('[Edit Historical] Calculate segments warning:', funcError);
      }

      await supabase.rpc('log_sensitive_data_access', {
        _action: 'edit_approved_timeentry_from_history',
        _resource_type: 'time_entries',
        _resource_id: entryId,
        _details: {
          old_clock_in: selectedEntry?.clock_in_time,
          new_clock_in: clockIn,
          old_clock_out: selectedEntry?.clock_out_time,
          new_clock_out: clockOut,
          reason: reason,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-timesheet-history'] });
      queryClient.invalidateQueries({ queryKey: ['daily-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      
      toast.success('✅ Pontaj istoric actualizat și timesheet recalculat');
      setEditDialogOpen(false);
      setPasswordVerified(false);
      setAdminPassword('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Eroare la salvare');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label>Caută angajat</Label>
          <Input
            placeholder="Nume sau username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="w-48">
          <Label>Perioadă</Label>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimele 7 zile</SelectItem>
              <SelectItem value="14">Ultimele 14 zile</SelectItem>
              <SelectItem value="30">Ultimele 30 zile</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-edited"
            checked={showOnlyEdited}
            onChange={(e) => setShowOnlyEdited(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="show-edited" className="cursor-pointer">
            Doar pontaje editate
          </Label>
        </div>

        <Button
          onClick={handleExportExcel}
          className="gap-2"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
      ) : filteredEntries && filteredEntries.length > 0 ? (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="bg-green-50 border-green-200 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{entry.profiles.full_name}</h3>
                      <Badge variant="outline">@{entry.profiles.username}</Badge>
                      {entry.was_edited_by_admin && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                          ✏️ Editat
                        </Badge>
                      )}
                    </div>
                    
                    {entry.was_edited_by_admin && entry.original_clock_in_time && entry.original_clock_out_time && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-2">
                        <p className="font-semibold text-sm text-yellow-900 dark:text-yellow-100 mb-1">
                          📋 Pontaj Original (Angajat)
                        </p>
                        <div className="text-xs space-y-1 text-yellow-800 dark:text-yellow-200">
                          <p>
                            ⏰ Intrare: <strong>{format(new Date(entry.original_clock_in_time), 'dd MMM yyyy HH:mm', { locale: ro })}</strong>
                          </p>
                          <p>
                            🚪 Ieșire: <strong>{format(new Date(entry.original_clock_out_time), 'dd MMM yyyy HH:mm', { locale: ro })}</strong>
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-sm space-y-1">
                      {entry.was_edited_by_admin && (
                        <p className="font-semibold text-green-700 dark:text-green-300">
                          🔧 Pontaj Corectat (Admin)
                        </p>
                      )}
                      <p>
                        ⏰ Intrare: <strong>{format(new Date(entry.clock_in_time), 'dd MMM yyyy HH:mm', { locale: ro })}</strong>
                      </p>
                      <p>
                        🚪 Ieșire: <strong>{format(new Date(entry.clock_out_time), 'dd MMM yyyy HH:mm', { locale: ro })}</strong>
                      </p>
                      <p className="text-muted-foreground">
                        ✅ Aprobat de <strong>{entry.approver_profile?.full_name || 'Admin'}</strong> la {format(new Date(entry.approved_at), 'dd MMM HH:mm', { locale: ro })}
                      </p>
                      {entry.approval_notes && (
                        <p className="text-xs italic text-muted-foreground">
                          📝 {entry.approval_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleOpenPasswordDialog(entry)}
                    className="shrink-0"
                    disabled={entry.approved_at !== null}
                    title={entry.approved_at ? "❌ Protejat - nu se poate edita" : "Editează pontaj"}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {entry.approved_at ? "Protejat" : "Editează"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nu există pontaje aprobate în perioada selectată
        </div>
      )}

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              🔒 Confirmare Editare Istoric
            </DialogTitle>
            <DialogDescription>
              Editezi un pontaj deja aprobat! Pentru securitate, introdu parola contului tău.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              ⚠️ Modificarea va suprascrie complet datele anterioare și va recalcula timesheet-ul.
            </AlertDescription>
          </Alert>

          <div className="py-4">
            <Label htmlFor="admin-password">Parola ta de cont</Label>
            <Input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && adminPassword) {
                  verifyPassword.mutate(adminPassword);
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              onClick={() => verifyPassword.mutate(adminPassword)}
              disabled={!adminPassword || verifyPassword.isPending}
            >
              {verifyPassword.isPending ? 'Verificare...' : '✅ Confirmă și Editează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Pencil className="h-5 w-5 inline mr-2" />
              Editează Pontaj Istoric - {selectedEntry?.profiles.full_name}
            </DialogTitle>
            <DialogDescription>
              Modificările vor suprascrie datele anterioare
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-clock-in">Ora Intrare</Label>
              <Input
                id="edit-clock-in"
                type="datetime-local"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-clock-out">Ora Ieșire</Label>
              <Input
                id="edit-clock-out"
                type="datetime-local"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
              />
            </div>

            {editClockIn && editClockOut && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Durată: {(() => {
                    const diff = new Date(editClockOut).getTime() - new Date(editClockIn).getTime();
                    if (diff <= 0) return 'Invalid';
                    const hours = Math.floor(diff / 3600000);
                    const minutes = Math.floor((diff % 3600000) / 60000);
                    return `${hours}h ${minutes}m`;
                  })()}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="edit-reason">
                Motiv Re-Editare <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Ex: Greșeală la introducerea inițială, ceas defect"
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Motivul va fi salvat în audit log și în notele de aprobare
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setPasswordVerified(false);
                setAdminPassword('');
              }}
            >
              Anulează
            </Button>
            <Button
              onClick={() => {
                if (selectedEntry) {
                  editHistoricalEntry.mutate({
                    entryId: selectedEntry.id,
                    clockIn: editClockIn,
                    clockOut: editClockOut,
                    reason: editReason,
                  });
                }
              }}
              disabled={!editReason.trim() || editHistoricalEntry.isPending}
            >
              {editHistoricalEntry.isPending ? 'Salvare...' : '💾 Salvează Modificarea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
