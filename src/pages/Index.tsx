import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp, Award, AlertTriangle, CheckCircle, MapPin, Smartphone, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import heroImage from "@/assets/hero-team.jpg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
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

const Index = () => {
  const { user } = useAuth();
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

  const getAlertMessage = (type: string) => {
    const messages: Record<string, string> = {
      device_change: 'Pontaj din dispozitiv nou detectat',
      suspicious_location: 'Locație neobișnuită detectată',
      rapid_movement: 'Deplasare neobișnuit de rapidă între pontaje',
      photo_mismatch: 'Verificare foto neconformă',
      pattern_anomaly: 'Anomalie în modelul de pontaj',
      excessive_duration: 'Durată excesivă de pontaj',
    };
    return messages[type] || 'Alertă de securitate';
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/20">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-4 border-b border-border/50 bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 px-4 md:px-6 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-base md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Dashboard
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Bine ai venit, <span className="font-medium text-foreground">{user?.email?.split('@')[0] || 'User'}</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {/* Hero Section */}
            <div className="relative h-32 md:h-48 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-primary opacity-90" />
              <img 
                src={heroImage} 
                alt="Team collaboration" 
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
              />
              <div className="relative h-full flex items-center px-4 md:px-6">
                <div>
                  <h2 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                    Time Tracking & Productivity
                  </h2>
                  <p className="text-white/90 text-sm md:text-base max-w-2xl">
                    Monitorizează timpul lucrat, gestionează proiecte și crește productivitatea.
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 md:p-6 space-y-4 md:space-y-6">
              {/* Quick Stats */}
              <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="hidden sm:inline">Ore Azi</span>
                      <span className="sm:hidden">Azi</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">0h</div>
                    <p className="text-xs text-muted-foreground mt-1">În pontaj</p>
                  </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-success" />
                      <span className="hidden sm:inline">Săptămâna</span>
                      <span className="sm:hidden">Săpt</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">0h</div>
                    <p className="text-xs text-muted-foreground mt-1">Total lucrat</p>
                  </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-info" />
                      <span className="hidden sm:inline">Luna</span>
                      <span className="sm:hidden">Lună</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">0h</div>
                    <p className="text-xs text-muted-foreground mt-1">Acest mois</p>
                  </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Award className="h-4 w-4 text-warning" />
                      <span className="hidden sm:inline">Concediu</span>
                      <span className="sm:hidden">CO</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">21</div>
                    <p className="text-xs text-muted-foreground mt-1">Zile rămase</p>
                  </CardContent>
                </Card>

              </div>

              {/* Secțiune Alerte Securitate */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">🚨 Alerte Securitate</h2>
                  <div className="flex gap-2">
                    <Button
                      variant={filter === 'unresolved' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('unresolved')}
                    >
                      Nerezolvate
                    </Button>
                    <Button
                      variant={filter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('all')}
                    >
                      Toate
                    </Button>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Alerte</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{alerts.length}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Nerezolvate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {alerts.filter(a => !a.resolved).length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Critice</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {alerts.filter(a => a.severity === 'critical' && !a.resolved).length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Rezolvate Azi</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
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
                          className={`cursor-pointer transition-colors overflow-hidden ${
                            !alert.resolved ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-accent/30'
                          }`}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <CardContent className="p-4 overflow-hidden">
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

                                  <p className="text-sm break-words overflow-wrap-anywhere">{getAlertMessage(alert.alert_type)}</p>

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
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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

              <p className="text-sm leading-relaxed break-words">{getAlertMessage(selectedAlert.alert_type)}</p>

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
    </SidebarProvider>
  );
};

export default Index;
