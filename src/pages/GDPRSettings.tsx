import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Download, Edit, Trash2, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function GDPRSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [requestDetails, setRequestDetails] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch user's GDPR requests
  const { data: gdprRequests, isLoading } = useQuery({
    queryKey: ['gdpr-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gdpr_requests' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  // Fetch user consents
  const { data: consents } = useQuery({
    queryKey: ['user-consents', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_consents' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  // Create GDPR request mutation
  const createRequest = useMutation({
    mutationFn: async (requestType: string) => {
      const { data, error } = await supabase
        .from('gdpr_requests' as any)
        .insert({
          user_id: user?.id,
          request_type: requestType,
          details: requestDetails || null,
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] });
      toast.success('Cerere GDPR trimisă cu succes');
      setRequestDetails('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la trimiterea cererii');
    },
  });

  // Export user data
  const exportData = useMutation({
    mutationFn: async () => {
      // Fetch all user data
      const [profile, timeEntries, vacations, schedules] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
        supabase.from('time_entries').select('*').eq('user_id', user?.id),
        supabase.from('vacation_requests').select('*').eq('user_id', user?.id),
        supabase.from('weekly_schedules').select('*').eq('user_id', user?.id),
      ]);

      const userData = {
        profile: profile.data,
        time_entries: timeEntries.data,
        vacation_requests: vacations.data,
        weekly_schedules: schedules.data,
        exported_at: new Date().toISOString(),
      };

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(userData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `date-personale-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return userData;
    },
    onSuccess: () => {
      toast.success('Datele au fost exportate cu succes');
      createRequest.mutate('export');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la exportarea datelor');
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
          <Shield className="h-8 w-8 text-primary" />
          Setări GDPR
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestionează-ți drepturile de protecție a datelor personale conform GDPR
        </p>
      </div>

      {/* Drepturile tale GDPR */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Drepturile tale GDPR
          </CardTitle>
          <CardDescription>
            Conform Regulamentului General privind Protecția Datelor (GDPR), ai următoarele drepturi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export Date */}
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">Dreptul de acces</h3>
              <p className="text-sm text-muted-foreground">
                Poți solicita o copie a tuturor datelor personale pe care le deținem despre tine
              </p>
            </div>
            <Button
              onClick={() => exportData.mutate()}
              disabled={exportData.isPending}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              {exportData.isPending ? 'Se exportă...' : 'Exportă datele mele'}
            </Button>
          </div>

          {/* Rectificare */}
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">Dreptul de rectificare</h3>
              <p className="text-sm text-muted-foreground">
                Poți cere corectarea datelor incorecte sau incomplete
              </p>
            </div>
            <div className="space-y-2">
              <Label>Detalii cerere (opțional)</Label>
              <Textarea
                placeholder="Descrie ce date dorești să fie rectificate..."
                value={requestDetails}
                onChange={(e) => setRequestDetails(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={() => createRequest.mutate('rectification')}
              disabled={createRequest.isPending}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Edit className="h-4 w-4 mr-2" />
              Solicită rectificare
            </Button>
          </div>

          {/* Ștergere Date */}
          <div className="border rounded-lg p-4 space-y-3 border-destructive/50 bg-destructive/5">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Dreptul la ștergere ("Dreptul de a fi uitat")
              </h3>
              <p className="text-sm text-muted-foreground">
                Poți solicita ștergerea datelor tale personale. Această acțiune poate fi ireversibilă.
              </p>
            </div>
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Solicită ștergerea datelor
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Această acțiune va crea o cerere de ștergere a tuturor datelor tale personale.
                    Un administrator va procesa cererea ta în cel mai scurt timp posibil.
                    După aprobarea cererii, datele vor fi șterse permanent și nu vor putea fi recuperate.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anulează</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      createRequest.mutate('deletion');
                      setShowDeleteConfirm(false);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmă cererea de ștergere
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Portabilitate */}
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">Dreptul la portabilitatea datelor</h3>
              <p className="text-sm text-muted-foreground">
                Poți solicita transferul datelor tale către alt furnizor de servicii
              </p>
            </div>
            <Button
              onClick={() => createRequest.mutate('portability')}
              disabled={createRequest.isPending}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              Solicită portabilitate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Istoric cereri GDPR */}
      <Card>
        <CardHeader>
          <CardTitle>Istoric cereri GDPR</CardTitle>
          <CardDescription>Cererile tale anterioare privind protecția datelor</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Se încarcă...</p>
          ) : gdprRequests && gdprRequests.length > 0 ? (
            <div className="space-y-3">
              {gdprRequests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          {getRequestTypeLabel(request.request_type)}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.details && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {request.details}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Creat: {format(new Date(request.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                      </p>
                      {request.processed_at && (
                        <p className="text-xs text-muted-foreground">
                          Procesat: {format(new Date(request.processed_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nu ai nicio cerere GDPR înregistrată
            </p>
          )}
        </CardContent>
      </Card>

      {/* Consimțăminte */}
      {consents && consents.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Consimțăminte acordate</CardTitle>
            <CardDescription>Istoricul consimțămintelor tale</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {consents.map((consent) => (
                <div key={consent.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{consent.consent_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {consent.consent_given
                          ? `Acordat: ${format(new Date(consent.consent_date || consent.created_at), 'dd MMM yyyy', { locale: ro })}`
                          : `Retras: ${format(new Date(consent.consent_withdrawn_date || consent.updated_at), 'dd MMM yyyy', { locale: ro })}`}
                      </p>
                    </div>
                    <Badge variant={consent.consent_given ? 'default' : 'secondary'}>
                      {consent.consent_given ? 'Activ' : 'Retras'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}