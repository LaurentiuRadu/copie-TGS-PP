import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Clock, AlertCircle, Calendar, User, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTableCard, MobileTableRow } from '@/components/MobileTableCard';

interface TardinessReport {
  id: string;
  user_id: string;
  scheduled_start_time: string;
  actual_clock_in_time: string;
  delay_minutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  profiles: {
    full_name: string;
    username: string;
  };
}

export const TardinessReportsManager = () => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    report: TardinessReport | null;
    action: 'approve' | 'reject' | null;
  }>({ open: false, report: null, action: null });
  const [adminNotes, setAdminNotes] = useState('');

  // Query for active (non-archived) reports
  const { data: activeReports, isLoading: isLoadingActive } = useQuery({
    queryKey: ['tardiness-reports-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tardiness_reports')
        .select(`
          *,
          profiles!user_id (
            full_name,
            username
          )
        `)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TardinessReport[];
    },
  });

  // Query for archived reports
  const { data: archivedReports, isLoading: isLoadingArchived } = useQuery({
    queryKey: ['tardiness-reports-archived'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tardiness_reports')
        .select(`
          *,
          profiles!user_id (
            full_name,
            username
          )
        `)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      return data as TardinessReport[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      reportId,
      status,
      notes,
    }: {
      reportId: string;
      status: 'approved' | 'rejected';
      notes: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('tardiness_reports')
        .update({
          status,
          admin_notes: notes,
          reviewed_by: userData.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tardiness-reports-active'] });
      toast.success('Raport întârziere procesat cu succes');
      setReviewDialog({ open: false, report: null, action: null });
      setAdminNotes('');
    },
    onError: (error) => {
      console.error('Error reviewing tardiness report:', error);
      toast.error('Eroare la procesarea raportului');
    },
  });

  // Mutation for archiving
  const archiveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.functions.invoke('archive-tardiness-report', {
        body: { report_id: reportId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tardiness-reports-active'] });
      queryClient.invalidateQueries({ queryKey: ['tardiness-reports-archived'] });
      toast.success('Raport arhivat cu succes');
    },
    onError: (error) => {
      console.error('Archive error:', error);
      toast.error('Nu s-a putut arhiva raportul');
    },
  });

  const handleReview = () => {
    if (!reviewDialog.report || !reviewDialog.action) return;

    reviewMutation.mutate({
      reportId: reviewDialog.report.id,
      status: reviewDialog.action === 'approve' ? 'approved' : 'rejected',
      notes: adminNotes,
    });
  };

  const handleArchive = (reportId: string) => {
    if (confirm('Sigur vrei să arhivezi acest raport?')) {
      archiveMutation.mutate(reportId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" /> În așteptare
        </Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <Check className="h-3 w-3 mr-1" /> Aprobat
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
          <X className="h-3 w-3 mr-1" /> Respins
        </Badge>;
      default:
        return null;
    }
  };

  const pendingCount = activeReports?.filter((r) => r.status === 'pending').length || 0;
  const isLoading = isLoadingActive || isLoadingArchived;

  const renderReports = (reports: TardinessReport[] | undefined, showArchiveButton: boolean) => {
    if (!reports || reports.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
          Nu există rapoarte
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-3">
          {reports.map((report) => (
            <MobileTableCard key={report.id}>
              <MobileTableRow
                label="Angajat"
                value={
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span className="font-medium">{report.profiles.full_name}</span>
                  </div>
                }
              />
              <MobileTableRow
                label="Data"
                value={
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(report.actual_clock_in_time), 'dd MMM yyyy, HH:mm', { locale: ro })}
                  </div>
                }
              />
              <MobileTableRow
                label="Întârziere"
                value={
                  <span className="text-red-600 font-semibold text-base">
                    +{report.delay_minutes} min
                  </span>
                }
              />
              <MobileTableRow
                label="Motiv"
                value={<span className="text-sm">{report.reason}</span>}
                fullWidth
              />
              <MobileTableRow
                label="Status"
                value={getStatusBadge(report.status)}
              />
              {report.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      setReviewDialog({
                        open: true,
                        report,
                        action: 'approve',
                      });
                    }}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Aprobă
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => {
                      setReviewDialog({
                        open: true,
                        report,
                        action: 'reject',
                      });
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Respinge
                  </Button>
                </div>
              )}
              {showArchiveButton && report.status !== 'pending' && (
                <div className="pt-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(report.id)}
                    disabled={archiveMutation.isPending}
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Arhivează
                  </Button>
                </div>
              )}
            </MobileTableCard>
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Angajat</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Întârziere</TableHead>
              <TableHead>Motiv</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">
                  {report.profiles.full_name}
                </TableCell>
                <TableCell>
                  {format(new Date(report.actual_clock_in_time), 'dd MMM yyyy, HH:mm', { locale: ro })}
                </TableCell>
                <TableCell>
                  <span className="text-red-600 font-semibold">
                    +{report.delay_minutes} min
                  </span>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {report.reason}
                </TableCell>
                <TableCell>{getStatusBadge(report.status)}</TableCell>
                <TableCell className="text-right">
                  {report.status === 'pending' ? (
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => {
                          setReviewDialog({
                            open: true,
                            report,
                            action: 'approve',
                          });
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => {
                          setReviewDialog({
                            open: true,
                            report,
                            action: 'reject',
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : showArchiveButton ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchive(report.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Arhivează
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Arhivat
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <Tabs defaultValue="active" className="w-full space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="relative">
            Rapoarte Active
            {pendingCount > 0 && (
              <div className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {pendingCount}
              </div>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived">Arhivă</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoadingActive ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            renderReports(activeReports, true)
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          {isLoadingArchived ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            renderReports(archivedReports, false)
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialog({ open: false, report: null, action: null });
            setAdminNotes('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[95vw] md:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' ? 'Aprobare' : 'Respingere'} Întârziere
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.report && (
                <>
                  <strong>{reviewDialog.report.profiles.full_name}</strong> -
                  Întârziere de {reviewDialog.report.delay_minutes} minute
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.report && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Motivul angajatului</Label>
                <p className="text-sm p-3 bg-muted rounded-md">
                  {reviewDialog.report.reason}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">
                  Notă administrator {reviewDialog.action === 'reject' && '(obligatorie)'}
                </Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Adaugă o notă despre această decizie..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialog({ open: false, report: null, action: null });
                setAdminNotes('');
              }}
            >
              Anulează
            </Button>
            <Button
              onClick={handleReview}
              disabled={
                reviewMutation.isPending ||
                (reviewDialog.action === 'reject' && !adminNotes.trim())
              }
              className={
                reviewDialog.action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {reviewMutation.isPending
                ? 'Se procesează...'
                : reviewDialog.action === 'approve'
                ? 'Aprobă'
                : 'Respinge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};