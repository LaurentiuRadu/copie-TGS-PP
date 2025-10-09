import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Plus, TrendingUp } from 'lucide-react';
import { useOptimizedVacations } from '@/hooks/useOptimizedVacations';
import { Progress } from '@/components/ui/progress';
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
import { AdminLayout } from '@/components/AdminLayout';
import { useUserRole } from '@/hooks/useUserRole';

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
  const { isAdmin } = useUserRole();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [vacationType, setVacationType] = useState<string>('vacation');
  const [reason, setReason] = useState('');

  // Folosim hook-ul optimizat cu React Query
  const { requests, balance, isLoading, createRequest, updateStatus } = useOptimizedVacations(
    user?.id,
    isAdmin
  );

  const handleCreateRequest = async () => {
    if (!user || !dateRange?.from || !dateRange?.to) {
      return;
    }

    const daysCount = differenceInDays(dateRange.to, dateRange.from) + 1;

    createRequest({
      user_id: user.id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
      days_count: daysCount,
      type: vacationType,
      reason: reason || null,
    });

    setShowNewRequest(false);
    setDateRange(undefined);
    setReason('');
    setVacationType('vacation');
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    if (!user) return;
    
    updateStatus({
      id,
      status,
      adminNotes,
      reviewedBy: user.id,
    });
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
    <AdminLayout 
      title="Concedii"
      actions={
        !isAdmin && (
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
                    onSelect={setDateRange}
                    locale={ro}
                    className="rounded-md border mt-2"
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                  />
                  {dateRange?.from && dateRange?.to && (
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
                  disabled={!dateRange?.from || !dateRange?.to}
                >
                  Trimite Cerere
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      }
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* Vacation Balance Card */}
        {balance && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Sold Concediu de Odihnă (CO) - {balance.year}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-600">{balance.total_days}</div>
                  <div className="text-sm text-muted-foreground">Total zile</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{balance.used_days}</div>
                  <div className="text-sm text-muted-foreground">Zile folosite</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-2xl font-bold text-yellow-600">{balance.pending_days}</div>
                  <div className="text-sm text-muted-foreground">În așteptare</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-2xl font-bold text-primary">{balance.remaining_days}</div>
                  <div className="text-sm text-muted-foreground">Zile disponibile</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progres utilizare</span>
                  <span className="font-medium">
                    {Math.round(((balance.used_days + balance.pending_days) / balance.total_days) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={((balance.used_days + balance.pending_days) / balance.total_days) * 100}
                  className="h-3"
                />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span>Folosite + În așteptare</span>
                  </div>
                </div>
              </div>

              {balance.notes && (
                <div className="text-sm text-muted-foreground italic border-l-2 border-primary pl-3">
                  {balance.notes}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Requests List */}
        <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin ? 'Toate Cererile' : 'Cererile Mele'} ({requests.length})
          </CardTitle>
        </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
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
    </AdminLayout>
  );
};

export default Vacations;