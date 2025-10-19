import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, MapPin, Smartphone, User, Shield, Clock as ClockIcon } from "lucide-react";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';

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

interface SecurityAlertsManagerProps {
  className?: string;
}

export function SecurityAlertsManager({ className }: SecurityAlertsManagerProps) {
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

      const { data: alertsData, error } = await query;
      if (error) throw error;

      if (alertsData && alertsData.length > 0) {
        const userIds = [...new Set(alertsData.map(alert => alert.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const enrichedAlerts = alertsData.map(alert => ({
          ...alert,
          profiles: profilesMap.get(alert.user_id) || null
        }));

        setAlerts(enrichedAlerts);
      } else {
        setAlerts([]);
      }
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
      critical: { label: 'Critică', class: 'bg-destructive/10 text-destructive-foreground' },
      high: { label: 'Ridicată', class: 'bg-warning/10 text-warning-foreground' },
      medium: { label: 'Medie', class: 'bg-warning/5 text-warning-foreground' },
      low: { label: 'Scăzută', class: 'bg-info/10 text-info-foreground' },
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

  return (
    <div className={className}>
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
              <div className="text-2xl font-bold text-warning">{unresolvedCount}</div>
            </CardContent>
          </Card>
          
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Critice Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
            </CardContent>
          </Card>
          
          <Card className="border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rezolvate Azi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{resolvedTodayCount}</div>
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
                            <Badge variant="outline" className="bg-success/10 text-success-foreground">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Rezolvată
                            </Badge>
                          )}
                        </div>
                      </div>
              <AlertDescription className="text-xs break-words line-clamp-2">
                {alert.message.length > 120 
                  ? `${alert.message.substring(0, 120)}...` 
                  : alert.message
                }
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
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-muted-foreground">Mesaj</p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      navigator.clipboard.writeText(selectedAlert.message);
                      toast.success("Mesaj copiat în clipboard");
                    }}
                  >
                    📋 Copiază
                  </Button>
                </div>
                <Alert>
                  <AlertDescription className="break-all max-h-[200px] overflow-y-auto text-xs font-mono">
                    {selectedAlert.message}
                  </AlertDescription>
                </Alert>
              </div>

              {selectedAlert.details && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Detalii Tehnice</p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedAlert.details, null, 2));
                        toast.success("JSON copiat în clipboard");
                      }}
                    >
                      📋 Copiază JSON
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/50">
                    <pre className="text-xs break-all">
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
                    className="bg-success hover:bg-success/90"
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
}
