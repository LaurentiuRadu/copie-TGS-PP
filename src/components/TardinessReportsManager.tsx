import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

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
  profiles: {
    full_name: string;
    username: string;
  };
}

export const TardinessReportsManager = () => {
  const queryClient = useQueryClient();
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    report: TardinessReport | null;
    action: 'approve' | 'reject' | null;
  }>({ open: false, report: null, action: null });
  const [adminNotes, setAdminNotes] = useState('');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['tardiness-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tardiness_reports')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
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
      queryClient.invalidateQueries({ queryKey: ['tardiness-reports'] });
      toast.success('Raport întârziere procesat cu succes');
      setReviewDialog({ open: false, report: null, action: null });
      setAdminNotes('');
    },
    onError: (error) => {
      console.error('Error reviewing tardiness report:', error);
      toast.error('Eroare la procesarea raportului');
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

  const pendingCount = reports?.filter((r) => r.status === 'pending').length || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Rapoarte Întârzieri
              </CardTitle>
              <CardDescription>
                Gestionează justificările pentru întârzieri
              </CardDescription>
            </div>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {pendingCount} în așteptare
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nu există rapoarte de întârzieri
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Angajat</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Întârziere</TableHead>
                    <TableHead>Motiv</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acțiuni</TableHead>
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
                      <TableCell>
                        {report.status === 'pending' ? (
                          <div className="flex gap-1">
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
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Procesat
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
        <DialogContent className="sm:max-w-md">
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
