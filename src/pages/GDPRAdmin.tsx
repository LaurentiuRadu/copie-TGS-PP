import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function GDPRAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [processingNotes, setProcessingNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch all GDPR requests
  const { data: gdprRequests, isLoading } = useQuery({
    queryKey: ['gdpr-requests-admin', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('gdpr_requests' as any)
        .select(`
          *,
          profiles:user_id (
            full_name,
            username
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  // Update GDPR request mutation
  const updateRequest = useMutation({
    mutationFn: async ({
      requestId,
      status,
      notes,
    }: {
      requestId: string;
      status: string;
      notes?: string;
    }) => {
      const updateData: any = {
        status,
        processed_by: user?.id,
        processed_at: new Date().toISOString(),
      };

      if (notes) {
        updateData.details = notes;
      }

      const { data, error } = await supabase
        .from('gdpr_requests' as any)
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // If deletion request is approved, handle actual deletion
      if (status === 'completed' && selectedRequest?.request_type === 'deletion') {
        // Note: In production, this should be handled by an edge function
        // to ensure proper cleanup of all user data
        toast.info('Cererea de ștergere a fost aprobată. Procesul de ștergere va fi finalizat în curând.');
      }

      return data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests-admin'] });
      toast.success('Cererea GDPR a fost actualizată');
      setSelectedRequest(null);
      setProcessingNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la actualizarea cererii');
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      in_progress: 'default',
      completed: 'default',
      rejected: 'destructive',
    };
    const labels: Record<string, string> = {
      pending: 'În așteptare',
      in_progress: 'În procesare',
      completed: 'Finalizată',
      rejected: 'Respinsă',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      export: 'Export date',
      rectification: 'Rectificare date',
      deletion: 'Ștergere date',
      portability: 'Portabilitate date',
      objection: 'Obiecție prelucrare',
    };
    return labels[type] || type;
  };

  const getPriorityIcon = (type: string) => {
    if (type === 'deletion') return <XCircle className="h-4 w-4 text-destructive" />;
    if (type === 'export') return <Clock className="h-4 w-4 text-info" />;
    return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
          <Shield className="h-8 w-8 text-primary" />
          Administrare GDPR
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestionează cererile de protecție a datelor personale ale utilizatorilor
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Label>Status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="pending">În așteptare</SelectItem>
                <SelectItem value="in_progress">În procesare</SelectItem>
                <SelectItem value="completed">Finalizate</SelectItem>
                <SelectItem value="rejected">Respinse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cereri GDPR</CardTitle>
          <CardDescription>
            {gdprRequests?.length || 0} cereri în total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Se încarcă...</p>
          ) : gdprRequests && gdprRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizator</TableHead>
                    <TableHead>Tip cerere</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data cererii</TableHead>
                    <TableHead>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gdprRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {request.profiles?.full_name || request.profiles?.username || 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.profiles?.username}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(request.request_type)}
                          {getRequestTypeLabel(request.request_type)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {format(new Date(request.created_at), 'dd MMM yyyy, HH:mm', {
                          locale: ro,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Procesează
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nu există cereri GDPR
            </p>
          )}
        </CardContent>
      </Card>

      {/* Process Request Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Procesează cerere GDPR</DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  Utilizator: {selectedRequest.profiles?.full_name || selectedRequest.profiles?.username}
                  <br />
                  Tip: {getRequestTypeLabel(selectedRequest.request_type)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {selectedRequest.details && (
                <div>
                  <Label>Detalii cerere:</Label>
                  <div className="border rounded-lg p-3 bg-muted/50 mt-1">
                    <p className="text-sm text-foreground">{selectedRequest.details}</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Note procesare (opțional):</Label>
                <Textarea
                  placeholder="Adaugă note despre procesarea acestei cereri..."
                  value={processingNotes}
                  onChange={(e) => setProcessingNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Status curent:</Label>
                <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
            >
              Anulează
            </Button>
            {selectedRequest?.status !== 'completed' && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    updateRequest.mutate({
                      requestId: selectedRequest.id,
                      status: 'in_progress',
                      notes: processingNotes,
                    })
                  }
                  disabled={updateRequest.isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  În procesare
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    updateRequest.mutate({
                      requestId: selectedRequest.id,
                      status: 'rejected',
                      notes: processingNotes,
                    })
                  }
                  disabled={updateRequest.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Respinge
                </Button>
                <Button
                  onClick={() =>
                    updateRequest.mutate({
                      requestId: selectedRequest.id,
                      status: 'completed',
                      notes: processingNotes,
                    })
                  }
                  disabled={updateRequest.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizează
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}