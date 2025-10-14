import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, TrendingUp, Clock, Calendar, AlertCircle, AlertTriangle, CheckCircle, MapPin, Smartphone, User, Shield, Clock as ClockIcon } from "lucide-react";
import { TimeEntryCorrectionRequestsManager } from "@/components/TimeEntryCorrectionRequestsManager";
import { SuspiciousEntriesManager } from "@/components/SuspiciousEntriesManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApprovalStatsDashboard } from "@/components/ApprovalStatsDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  details: any;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  user_id: string;
  time_entry_id: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

const Admin = () => {
  const isMobile = useIsMobile();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'unresolved') {
        query = query.eq('resolved', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch user names separately
      const alertsWithProfiles = await Promise.all(
        (data || []).map(async (alert) => {
          if (alert.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', alert.user_id)
              .single();
            return { ...alert, profiles: profile };
          }
          return alert;
        })
      );
      
      setAlerts(alertsWithProfiles);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Eroare la încărcarea alertelor');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;
      
      toast.success('Alertă rezolvată cu succes');
      fetchAlerts();
      setSelectedAlert(null);
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Eroare la rezolvarea alertei');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      critical: { label: 'Critică', class: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
      high: { label: 'Ridicată', class: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
      medium: { label: 'Medie', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
      low: { label: 'Scăzută', class: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
    };
    const { label, class: className } = config[severity as keyof typeof config] || config.low;
    return <Badge className={className}>{label}</Badge>;
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      suspicious_location: '📍 Locație Suspectă',
      photo_mismatch: '📷 Nepotrivire Foto',
      rapid_movement: '🚗 Mișcare Rapidă',
      device_change: '📱 Schimbare Dispozitiv',
      excessive_duration: '⏱️ Durată Excesivă',
    };
    return labels[type] || type;
  };

  const getAlertIcon = (type: string) => {
    const icons: Record<string, any> = {
      suspicious_location: MapPin,
      photo_mismatch: User,
      rapid_movement: AlertTriangle,
      device_change: Smartphone,
      excessive_duration: ClockIcon,
    };
    const Icon = icons[type] || Shield;
    return <Icon className="h-5 w-5" />;
  };

  const unresolvedCount = alerts.filter(a => !a.resolved).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const resolvedTodayCount = alerts.filter(a => {
    if (!a.resolved_at) return false;
    const resolvedDate = new Date(a.resolved_at);
    const today = new Date();
    return resolvedDate.toDateString() === today.toDateString();
  }).length;

  // ✅ Batch all admin stats in a single edge function call
  const { data: adminStats } = useQuery({
    queryKey: ['admin-stats-batch'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-admin-stats');
      
      if (error) throw error;
      return data as {
        totalEmployees: number;
        activeToday: number;
        pendingVacations: number;
        pendingCorrections: number;
        avgHours: string;
      };
    },
    staleTime: 60000, // 1 min
    refetchInterval: 30000, // Refetch every 30s for real-time updates
  });

  const totalEmployees = adminStats?.totalEmployees || 0;
  const activeToday = adminStats?.activeToday || 0;
  const pendingVacations = adminStats?.pendingVacations || 0;
  const pendingCount = adminStats?.pendingCorrections || 0;
  const avgHours = adminStats?.avgHours || '0.0';

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
        {/* 📋 HEADER CU BADGE COMPACT */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Panou Administrare</h1>
          
          {pendingCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-400 dark:bg-yellow-950/30 dark:text-yellow-300 cursor-help">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    ⚠️ {pendingCount} {pendingCount === 1 ? 'cerere' : 'cereri'} pending
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">
                    <strong>{pendingCount} cerere{pendingCount !== 1 ? 'ri' : ''} de corecție</strong> așteaptă aprobare.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Scroll jos pentru a le procesa.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <ErrorBoundary>
          <TimeEntryCorrectionRequestsManager />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <SuspiciousEntriesManager />
        </ErrorBoundary>

        <ErrorBoundary>
          <ApprovalStatsDashboard />
        </ErrorBoundary>

        {/* 📊 STATISTICI REALE */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={cn(
            "shadow-elegant transition-all duration-300 border-primary/20",
            isMobile ? "stat-card" : "hover:shadow-glow bg-gradient-card"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Angajați</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Activi în sistem</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "shadow-elegant transition-all duration-300 border-success/20",
            isMobile ? "stat-card" : "hover:shadow-glow bg-gradient-card"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activi Astăzi</CardTitle>
              <Clock className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeToday}</div>
              <p className="text-xs text-muted-foreground">Pontați în prezent</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "shadow-elegant transition-all duration-300 border-warning/20",
            isMobile ? "stat-card" : "hover:shadow-glow bg-gradient-card"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cereri Concediu</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingVacations}</div>
              <p className="text-xs text-muted-foreground">În așteptare aprobare</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "shadow-elegant transition-all duration-300 border-info/20",
            isMobile ? "stat-card" : "hover:shadow-glow bg-gradient-card"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ore Medii/Zi</CardTitle>
              <TrendingUp className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgHours}h</div>
              <p className="text-xs text-muted-foreground">Săptămâna curentă</p>
            </CardContent>
          </Card>
        </div>

        {/* 🚨 ALERTE SECURITATE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-destructive" />
              Alerte Securitate
            </h2>
            <div className="flex gap-2">
              <Button
                variant={filter === 'unresolved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unresolved')}
              >
                Nerezolvate ({unresolvedCount})
              </Button>
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                Toate ({alerts.length})
              </Button>
            </div>
          </div>

          {/* Statistici Alerte */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-destructive/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Alerte</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alerts.length}</div>
              </CardContent>
            </Card>
            
            <Card className="border-yellow-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Nerezolvate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{unresolvedCount}</div>
              </CardContent>
            </Card>
            
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Critice Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
              </CardContent>
            </Card>
            
            <Card className="border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rezolvate Azi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{resolvedTodayCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Listă Alerte */}
          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Se încarcă alertele...</p>
            </Card>
          ) : alerts.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-medium">Nicio alertă {filter === 'unresolved' ? 'activă' : 'găsită'}</p>
              <p className="text-sm text-muted-foreground">Sistemul funcționează normal</p>
            </Card>
          ) : (
            <ScrollArea className="h-[600px] rounded-md border">
              <div className="p-4 space-y-3">
                {alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    variant={alert.resolved ? 'default' : 'destructive'}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.alert_type)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <AlertTitle className="text-sm font-medium">
                            {getAlertTypeLabel(alert.alert_type)}
                          </AlertTitle>
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(alert.severity)}
                            {alert.resolved && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/30">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Rezolvată
                              </Badge>
                            )}
                          </div>
                        </div>
                        <AlertDescription className="text-xs">
                          {alert.message}
                        </AlertDescription>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                          <span>👤 {alert.profiles?.full_name || 'Utilizator necunoscut'}</span>
                          <span>📅 {format(new Date(alert.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}</span>
                        </div>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Dialog Detalii Alertă */}
        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedAlert && getAlertIcon(selectedAlert.alert_type)}
                Detalii Alertă Securitate
              </DialogTitle>
              <DialogDescription>
                Informații complete despre această alertă de securitate
              </DialogDescription>
            </DialogHeader>
            
            {selectedAlert && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tip Alertă</p>
                    <p className="text-sm">{getAlertTypeLabel(selectedAlert.alert_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Severitate</p>
                    <div className="mt-1">{getSeverityBadge(selectedAlert.severity)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Utilizator</p>
                    <p className="text-sm">{selectedAlert.profiles?.full_name || 'Necunoscut'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant={selectedAlert.resolved ? 'outline' : 'destructive'} className="mt-1">
                      {selectedAlert.resolved ? '✅ Rezolvată' : '⚠️ Activă'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Mesaj</p>
                  <Alert>
                    <AlertDescription>{selectedAlert.message}</AlertDescription>
                  </Alert>
                </div>

                {selectedAlert.details && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Detalii Tehnice</p>
                    <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/50">
                      <pre className="text-xs">
                        {JSON.stringify(selectedAlert.details, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium">Creată la:</p>
                    <p>{format(new Date(selectedAlert.created_at), 'dd MMMM yyyy, HH:mm:ss', { locale: ro })}</p>
                  </div>
                  {selectedAlert.resolved_at && (
                    <div>
                      <p className="font-medium">Rezolvată la:</p>
                      <p>{format(new Date(selectedAlert.resolved_at), 'dd MMMM yyyy, HH:mm:ss', { locale: ro })}</p>
                    </div>
                  )}
                </div>

                {!selectedAlert.resolved && (
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                      Închide
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleResolve(selectedAlert.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marchează ca Rezolvată
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default Admin;
