import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Clock, MapPin, Smartphone, User } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminLayout } from '@/components/layouts/AdminLayout';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  details: any;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

const Alerts = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'unresolved') {
        query = query.eq('resolved', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const alertsWithProfiles = await Promise.all(
          data.map(async (alert) => {
            if (!alert.user_id) return { ...alert, profiles: null };
            
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', alert.user_id)
              .single();
            
            return { ...alert, profiles: profile };
          })
        );
        setAlerts(alertsWithProfiles as SecurityAlert[]);
      }
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      toast.error('Eroare la încărcarea alertelor');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Alertă rezolvată');
      fetchAlerts();
      setSelectedAlert(null);
    } catch (error: any) {
      console.error('Error resolving alert:', error);
      toast.error('Eroare la rezolvarea alertei');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, 'info' | 'warning' | 'warning' | 'destructive'> = {
      low: 'info',
      medium: 'warning',
      high: 'warning',
      critical: 'destructive',
    };
    // @ts-ignore
    return <Badge variant={variants[severity] || 'default'} className="animate-glow-pulse">{severity.toUpperCase()}</Badge>;
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      suspicious_location: 'Locație Suspectă',
      rapid_movement: 'Mișcare Rapidă',
      photo_mismatch: 'Fotografie Nu Corespunde',
      pattern_anomaly: 'Pattern Anormal',
      device_change: 'Schimbare Dispozitiv',
    };
    return labels[type] || type;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'suspicious_location':
        return <MapPin className="w-5 h-5" />;
      case 'rapid_movement':
        return <Clock className="w-5 h-5" />;
      case 'photo_mismatch':
        return <User className="w-5 h-5" />;
      case 'device_change':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <AdminLayout title="Alerte Securitate">
      <div className="p-6 space-y-6 bg-mesh min-h-screen">
        <div className="flex items-center justify-between animate-slide-up-fade">
          <div className="flex gap-2">
            <Button
              variant={filter === 'unresolved' ? 'default' : 'glass'}
              onClick={() => setFilter('unresolved')}
              className="transition-all duration-300"
            >
              Nerezolvate
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'glass'}
              onClick={() => setFilter('all')}
              className="transition-all duration-300"
            >
              Toate
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-card elevated-card animate-slide-up-fade border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Total Alerte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold bg-gradient-primary-action bg-clip-text text-transparent">{alerts.length}</div>
            </CardContent>
          </Card>

          <Card className="glass-card elevated-card animate-slide-up-fade border-warning/30" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                Nerezolvate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-warning animate-glow-pulse">
                {alerts.filter(a => !a.resolved).length}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card elevated-card animate-slide-up-fade border-destructive/30" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Critice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-destructive animate-glow-pulse">
                {alerts.filter(a => a.severity === 'critical' && !a.resolved).length}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card elevated-card animate-slide-up-fade border-success/30" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Rezolvate Azi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-success">
                {alerts.filter(a => a.resolved && a.resolved_at && 
                  new Date(a.resolved_at).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-primary/10 animate-slide-up-fade" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Listă Alerte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse-soft">
                Se încarcă...
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success opacity-50" />
                Nu există alerte
              </div>
            ) : (
              alerts.map((alert, index) => (
                <Card 
                  key={alert.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-[1.01] animate-slide-up-fade ${
                    !alert.resolved 
                      ? 'glass-card border-destructive/30 glow-primary' 
                      : 'glass-card border-success/20'
                  }`}
                  style={{ animationDelay: `${0.5 + index * 0.05}s` }}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-3 rounded-xl backdrop-blur-sm transition-all duration-300 ${
                          alert.severity === 'critical' ? 'bg-destructive/20 glow-primary' :
                          alert.severity === 'high' ? 'bg-warning/20' :
                          'bg-info/20'
                        }`}>
                          {getAlertIcon(alert.alert_type)}
                        </div>
                        
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-lg">
                              {getAlertTypeLabel(alert.alert_type)}
                            </span>
                            {getSeverityBadge(alert.severity)}
                            {alert.resolved && (
                              <Badge variant="success">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Rezolvat
                              </Badge>
                            )}
                          </div>

                          {alert.profiles?.full_name && (
                            <div className="text-sm text-muted-foreground font-medium">
                              👤 Angajat: {alert.profiles.full_name}
                            </div>
                          )}

                          <p className="text-sm leading-relaxed">{alert.message}</p>

                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(alert.created_at), 'dd MMM yyyy HH:mm', { locale: ro })}
                          </div>
                        </div>
                      </div>

                      {!alert.resolved && (
                        <Button
                          size="sm"
                          variant="glass"
                          className="ml-4 hover:scale-105"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(alert.id);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Rezolvă
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="max-w-2xl glass-card border-primary/20 animate-scale-in">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-primary" />
                Detalii Alertă
              </DialogTitle>
            </DialogHeader>
            
            {selectedAlert && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 p-4 rounded-xl glass-card border-primary/20">
                  <div className="p-3 rounded-xl bg-primary/10">
                    {getAlertIcon(selectedAlert.alert_type)}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-xl block">
                      {getAlertTypeLabel(selectedAlert.alert_type)}
                    </span>
                    {getSeverityBadge(selectedAlert.severity)}
                  </div>
                </div>

                <div className="p-4 rounded-xl glass-card">
                  <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Mesaj:
                  </h4>
                  <p className="leading-relaxed">{selectedAlert.message}</p>
                </div>

                {selectedAlert.profiles?.full_name && (
                  <div className="p-4 rounded-xl glass-card">
                    <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Angajat:
                    </h4>
                    <p className="font-medium">{selectedAlert.profiles.full_name}</p>
                  </div>
                )}

                {selectedAlert.details && (
                  <div className="p-4 rounded-xl glass-card">
                    <h4 className="font-semibold mb-2 text-primary">Detalii Tehnice:</h4>
                    <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-auto backdrop-blur-sm">
                      {JSON.stringify(selectedAlert.details, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="p-4 rounded-xl glass-card">
                  <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Data Creare:
                  </h4>
                  <p className="font-medium">{format(new Date(selectedAlert.created_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}</p>
                </div>

                {selectedAlert.resolved_at && (
                  <div className="p-4 rounded-xl glass-card border-success/30">
                    <h4 className="font-semibold mb-2 text-success flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Rezolvat La:
                    </h4>
                    <p className="font-medium">{format(new Date(selectedAlert.resolved_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}</p>
                  </div>
                )}

                {!selectedAlert.resolved && (
                  <Button 
                    onClick={() => handleResolve(selectedAlert.id)}
                    className="w-full h-12 text-base hover:scale-[1.02]"
                    variant="default"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Marchează ca Rezolvat
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Alerts;