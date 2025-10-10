import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Clock, MapPin, Smartphone, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

      // Fetch profiles
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
    const colors: Record<string, string> = {
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500',
    };
    return <Badge className={colors[severity] || 'bg-gray-500'}>{severity.toUpperCase()}</Badge>;
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
    <div className="w-full p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === 'unresolved' ? 'default' : 'outline'}
            onClick={() => setFilter('unresolved')}
          >
            Nerezolvate
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Toate
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Alerte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Nerezolvate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {alerts.filter(a => !a.resolved).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {alerts.filter(a => a.severity === 'critical' && !a.resolved).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rezolvate Azi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {alerts.filter(a => a.resolved && a.resolved_at && 
                new Date(a.resolved_at).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Listă Alerte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Se încarcă...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nu există alerte
            </div>
          ) : (
            alerts.map((alert) => (
              <Card 
                key={alert.id}
                className={`cursor-pointer transition-colors ${
                  !alert.resolved ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-accent/30'
                }`}
                onClick={() => setSelectedAlert(alert)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900' :
                        alert.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900' :
                        'bg-yellow-100 dark:bg-yellow-900'
                      }`}>
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {getAlertTypeLabel(alert.alert_type)}
                          </span>
                          {getSeverityBadge(alert.severity)}
                          {alert.resolved && (
                            <Badge className="bg-green-500">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Rezolvat
                            </Badge>
                          )}
                        </div>

                        {alert.profiles?.full_name && (
                          <div className="text-sm text-muted-foreground">
                            Angajat: {alert.profiles.full_name}
                          </div>
                        )}

                        <p className="text-sm">{alert.message}</p>

                        <div className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), 'dd MMM yyyy HH:mm', { locale: ro })}
                        </div>
                      </div>
                    </div>

                    {!alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-4"
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

      {/* Detail Modal */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalii Alertă</DialogTitle>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getAlertIcon(selectedAlert.alert_type)}
                <span className="font-semibold text-lg">
                  {getAlertTypeLabel(selectedAlert.alert_type)}
                </span>
                {getSeverityBadge(selectedAlert.severity)}
              </div>

              <div>
                <h4 className="font-semibold mb-1">Mesaj:</h4>
                <p>{selectedAlert.message}</p>
              </div>

              {selectedAlert.profiles?.full_name && (
                <div>
                  <h4 className="font-semibold mb-1">Angajat:</h4>
                  <p>{selectedAlert.profiles.full_name}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-1">Data Creare:</h4>
                <p>{format(new Date(selectedAlert.created_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}</p>
              </div>

              {selectedAlert.resolved_at && (
                <div>
                  <h4 className="font-semibold mb-1">Rezolvat La:</h4>
                  <p>{format(new Date(selectedAlert.resolved_at), 'dd MMMM yyyy, HH:mm', { locale: ro })}</p>
                </div>
              )}

              {!selectedAlert.resolved && (
                <Button 
                  onClick={() => handleResolve(selectedAlert.id)}
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marchează ca Rezolvat
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;