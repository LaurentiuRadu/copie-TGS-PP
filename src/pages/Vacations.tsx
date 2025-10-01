import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  type: string;
  status: string;
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

const Vacations = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [vacationType, setVacationType] = useState<string>('vacation');
  const [reason, setReason] = useState('');

  useEffect(() => {
    checkAdminRole();
    fetchRequests();
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    setIsAdmin(!!data);
  };

  const fetchRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('vacation_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admins only see their own requests
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for admin view
      if (isAdmin && data) {
        const requestsWithProfiles = await Promise.all(
          data.map(async (req) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', req.user_id)
              .single();
            return { ...req, profiles: profile };
          })
        );
        setRequests(requestsWithProfiles as VacationRequest[]);
      } else {
        setRequests(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      toast.error('Eroare la încărcarea cererilor');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!user || !dateRange.from || !dateRange.to) {
      toast.error('Selectează perioada de concediu');
      return;
    }

    const daysCount = differenceInDays(dateRange.to, dateRange.from) + 1;

    try {
      const { error } = await supabase
        .from('vacation_requests')
        .insert([{
          user_id: user.id,
          start_date: format(dateRange.from, 'yyyy-MM-dd'),
          end_date: format(dateRange.to, 'yyyy-MM-dd'),
          days_count: daysCount,
          type: vacationType,
          reason: reason || null,
        }]);

      if (error) throw error;

      toast.success('Cerere trimisă cu succes');
      setShowNewRequest(false);
      setDateRange({ from: undefined, to: undefined });
      setReason('');
      setVacationType('vacation');
      fetchRequests();
    } catch (error: any) {
      console.error('Error creating request:', error);
      toast.error('Eroare la crearea cererii');
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    try {
      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status,
          admin_notes: adminNotes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(status === 'approved' ? 'Cerere aprobată' : 'Cerere respinsă');
      fetchRequests();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Eroare la actualizarea cererii');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Aprobat</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Respins</Badge>;
      default:
        return <Badge className="bg-yellow-500">În așteptare</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: 'Concediu',
      sick: 'Medical',
      unpaid: 'Fără plată',
      other: 'Altele',
    };
    return labels[type] || type;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Concedii</h1>
        {!isAdmin && (
          <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Cerere Nouă
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cerere Concediu Nouă</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>Tip Concediu</Label>
                  <Select value={vacationType} onValueChange={setVacationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">Concediu de odihnă</SelectItem>
                      <SelectItem value="sick">Medical</SelectItem>
                      <SelectItem value="unpaid">Fără plată</SelectItem>
                      <SelectItem value="other">Altele</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Selectează Perioada</Label>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                    locale={ro}
                    className="rounded-md border mt-2"
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                  />
                  {dateRange.from && dateRange.to && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {differenceInDays(dateRange.to, dateRange.from) + 1} zile selectate
                    </p>
                  )}
                </div>

                <div>
                  <Label>Motiv (opțional)</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descrie motivul cererii..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleCreateRequest}
                  className="w-full"
                  disabled={!dateRange.from || !dateRange.to}
                >
                  Trimite Cerere
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin ? 'Toate Cererile' : 'Cererile Mele'} ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Se încarcă...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nu există cereri
            </div>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="bg-accent/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      {isAdmin && request.profiles?.full_name && (
                        <div className="font-semibold text-lg">
                          {request.profiles.full_name}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(request.start_date), 'dd MMM yyyy', { locale: ro })}
                          {' - '}
                          {format(new Date(request.end_date), 'dd MMM yyyy', { locale: ro })}
                        </span>
                        <Badge variant="outline">{request.days_count} zile</Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{getTypeLabel(request.type)}</Badge>
                        {getStatusBadge(request.status)}
                      </div>

                      {request.reason && (
                        <p className="text-sm text-muted-foreground">
                          {request.reason}
                        </p>
                      )}

                      {request.admin_notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Notă admin:</strong> {request.admin_notes}
                        </div>
                      )}
                    </div>

                    {isAdmin && request.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50"
                          onClick={() => handleUpdateStatus(request.id, 'approved')}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobă
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleUpdateStatus(request.id, 'rejected')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Respinge
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Vacations;