import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Shield, FileText, AlertCircle, CheckCircle, Clock, XCircle, Users, UserX, AlertTriangle } from "lucide-react";
import { getUsersWithoutConsents } from "@/lib/gdprHelpers";

type GDPRRequest = {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  details?: any;
  requested_at: string;
  processed_at?: string;
  processed_by?: string;
  profiles?: {
    username?: string;
    full_name?: string;
  };
};

const GDPRAdmin = () => {
  const [selectedRequest, setSelectedRequest] = useState<GDPRRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [usersWithoutConsents, setUsersWithoutConsents] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [totalProfiles, setTotalProfiles] = useState(0);

  const queryClient = useQueryClient();

  // Fetch users without consents și total profiluri
  useEffect(() => {
    const fetchUsersWithoutConsents = async () => {
      setLoadingUsers(true);
      const users = await getUsersWithoutConsents();
      setUsersWithoutConsents(users);
      setLoadingUsers(false);
    };
    
    const fetchTotalProfiles = async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      
      if (!error && count !== null) {
        setTotalProfiles(count);
      }
    };
    
    fetchUsersWithoutConsents();
    fetchTotalProfiles();
  }, []);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['gdpr-requests', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('gdpr_requests')
        .select(`
          *,
          profiles:user_id (username, full_name)
        `)
        .order('requested_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GDPRRequest[];
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: any = {
        status,
        processed_at: new Date().toISOString(),
        processed_by: user?.id,
      };

      if (notes) {
        updates.details = { admin_notes: notes };
      }

      const { error } = await supabase
        .from('gdpr_requests')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] });
      toast.success("Cerere GDPR actualizată cu succes");
      setDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes("");
      setNewStatus("");
    },
    onError: (error) => {
      toast.error(`Eroare: ${error.message}`);
    },
  });

  const handleProcessRequest = (request: GDPRRequest) => {
    setSelectedRequest(request);
    setNewStatus(request.status);
    setAdminNotes(request.details?.admin_notes || "");
    setDialogOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedRequest || !newStatus) return;
    updateRequestMutation.mutate({
      id: selectedRequest.id,
      status: newStatus,
      notes: adminNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, icon: any }> = {
      pending: { variant: "outline", label: "În așteptare", icon: Clock },
      in_progress: { variant: "secondary", label: "În procesare", icon: AlertCircle },
      completed: { variant: "default", label: "Finalizat", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Respins", icon: XCircle },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getRequestTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      export: "Export date",
      deletion: "Ștergere date",
      rectification: "Rectificare date",
      portability: "Portabilitate date",
    };
    return types[type] || type;
  };

  const getPriorityIcon = (type: string) => {
    if (type === 'deletion') return <AlertCircle className="h-4 w-4 text-destructive" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  // Statistici corecte
  const totalUsers = totalProfiles;
  const usersWithConsents = totalUsers - usersWithoutConsents.length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Administrare GDPR</h1>
        </div>
        <p className="text-muted-foreground">
          Gestionare cereri GDPR și protecție date personale
        </p>
      </div>

      {/* Statistici Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Utilizatori</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6" />
              {totalUsers}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Cu Consimțăminte Complete</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              {usersWithConsents}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Fără Consimțăminte</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2 text-destructive">
              <UserX className="h-6 w-6" />
              {usersWithoutConsents.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">
            <FileText className="h-4 w-4 mr-2" />
            Cereri GDPR
          </TabsTrigger>
          <TabsTrigger value="missing-consents">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Utilizatori fără Consimțăminte
            {usersWithoutConsents.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {usersWithoutConsents.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Cereri GDPR */}
        <TabsContent value="requests">
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cereri GDPR</CardTitle>
              <CardDescription>
                Toate cererile de acces, rectificare și ștergere date
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrare status" />
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Se încarcă cererile...</p>
          ) : !requests || requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nu există cereri GDPR</p>
          ) : (
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
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profiles?.full_name || request.profiles?.username || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(request.request_type)}
                        {getRequestTypeLabel(request.request_type)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {format(new Date(request.requested_at), "dd MMM yyyy, HH:mm", { locale: ro })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessRequest(request)}
                      >
                        Procesează
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Utilizatori fără Consimțăminte */}
      <TabsContent value="missing-consents">
        <Card>
          <CardHeader>
            <CardTitle>Utilizatori fără Consimțăminte GDPR Complete</CardTitle>
            <CardDescription>
              Angajați care nu au acordat toate cele 4 consimțăminte obligatorii
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <p className="text-center text-muted-foreground py-8">Se încarcă utilizatorii...</p>
            ) : usersWithoutConsents.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Excelent!</h3>
                <p className="text-muted-foreground">
                  Toți utilizatorii au acordat consimțămintele GDPR obligatorii
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      {usersWithoutConsents.length} utilizatori necesită atenție
                    </p>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Acești angajați nu pot utiliza aplicația de pontaj până când nu acordă toate consimțămintele GDPR obligatorii.
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilizator</TableHead>
                      <TableHead>Consimțăminte Lipsă</TableHead>
                      <TableHead>Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithoutConsents.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p className="font-semibold">{user.full_name || user.username}</p>
                            <p className="text-xs text-muted-foreground">{user.username}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.missingConsents.map((consent: string) => (
                              <Badge key={consent} variant="destructive" className="text-xs">
                                {consent === 'biometric_data' && 'Date Biometrice'}
                                {consent === 'gps_tracking' && 'GPS'}
                                {consent === 'photo_capture' && 'Fotografii'}
                                {consent === 'data_processing' && 'Procesare Date'}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {user.missingConsents.length} lipsă din 4
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Acțiuni Recomandate:</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>Utilizatorii vor vedea automat GDPRConsentDialog la următoarea autentificare</li>
                    <li>Un banner roșu persistent le va aminti să completeze consimțămintele</li>
                    <li>Nu vor putea accesa funcționalitățile de pontaj până nu completează toate consimțămintele</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Procesare cerere GDPR</DialogTitle>
            <DialogDescription>
              Actualizează statusul și adaugă note administrative
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Utilizator</Label>
                  <p className="font-medium">
                    {selectedRequest.profiles?.full_name || selectedRequest.profiles?.username}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tip cerere</Label>
                  <p className="font-medium">{getRequestTypeLabel(selectedRequest.request_type)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data cererii</Label>
                  <p className="font-medium">
                    {format(new Date(selectedRequest.requested_at), "dd MMM yyyy, HH:mm", { locale: ro })}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status curent</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Schimbă status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selectează status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">În așteptare</SelectItem>
                    <SelectItem value="in_progress">În procesare</SelectItem>
                    <SelectItem value="completed">Finalizat</SelectItem>
                    <SelectItem value="rejected">Respins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note administrative</Label>
                <Textarea
                  id="notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adaugă detalii despre procesarea cererii..."
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anulează
            </Button>
            <Button onClick={handleUpdateStatus} disabled={!newStatus}>
              Salvează modificări
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GDPRAdmin;
