import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Smartphone, Monitor, Tablet, Clock, X, ClipboardCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";
import { ro } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

interface Session {
  id: string;
  session_id: string;
  device_fingerprint: string;
  device_info: any;
  last_activity: string;
  created_at: string;
  expires_at: string;
  active_time_entry?: {
    id: string;
    clock_in_time: string;
    clock_out_time: string | null;
    approval_status: string;
  } | null;
}

export function ActiveSessionsManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const loadSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = roleData?.map(r => r.role) || [];
      const userRole = roles.includes('admin') ? 'admin' : 'employee';

      const { data, error } = await supabase.functions.invoke('manage-sessions', {
        body: { 
          action: 'list',
          userId: user.id,
          userRole,
          includeTimeEntries: true
        }
      });

      if (error) throw error;
      setSessions(data.sessions || []);
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      toast.error("Eroare la încărcarea sesiunilor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleLogoutAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = roleData?.map(r => r.role) || [];
      const userRole = roles.includes('admin') ? 'admin' : 'employee';

      const { data, error } = await supabase.functions.invoke('manage-sessions', {
        body: { 
          action: 'logout-all',
          userId: user.id,
          userRole,
          excludeCurrentSession: true,
          reason: 'user_requested_logout_all'
        }
      });

      if (error) throw error;
      
      toast.success(data.message || "Toate sesiunile au fost închise");
      setShowLogoutAll(false);
      loadSessions();
    } catch (error: any) {
      console.error('Failed to logout all sessions:', error);
      toast.error("Eroare la închiderea sesiunilor");
    }
  };

  const handleLogoutSingle = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = roleData?.map(r => r.role) || [];
      const userRole = roles.includes('admin') ? 'admin' : 'employee';

      const { data, error } = await supabase.functions.invoke('manage-sessions', {
        body: { 
          action: 'logout-single',
          userId: user.id,
          userRole,
          sessionId
        }
      });

      if (error) throw error;
      
      toast.success("Sesiune închisă cu succes");
      loadSessions();
    } catch (error: any) {
      console.error('Failed to logout session:', error);
      toast.error("Eroare la închiderea sesiunii");
    }
  };

  const getDeviceIcon = (deviceInfo: any) => {
    const deviceType = deviceInfo?.deviceType?.toLowerCase() || '';
    if (deviceType.includes('mobile')) return <Smartphone className="h-4 w-4" />;
    if (deviceType.includes('tablet')) return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceName = (deviceInfo: any) => {
    if (!deviceInfo) return 'Dispozitiv necunoscut';
    const { browser, os, deviceType } = deviceInfo;
    return `${browser || 'Browser'} pe ${os || 'OS'} (${deviceType || 'Desktop'})`;
  };

  if (loading || roleLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxSessions = isAdmin ? 4 : 1;
  const isApproachingLimit = isAdmin && sessions.length >= 3;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Sesiuni Active
                <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                  {isAdmin ? "Admin" : "Angajat"}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {isAdmin 
                  ? "Poți fi conectat pe până la 4 dispozitive simultan" 
                  : "Poți fi conectat doar pe un singur dispozitiv"}
              </CardDescription>
              {sessions.length > 0 && (
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  Sesiuni active: <strong>{sessions.length}</strong> / {maxSessions}
                  {isApproachingLimit && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Aproape de limită
                    </Badge>
                  )}
                </div>
              )}
            </div>
            {sessions.length > 1 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowLogoutAll(true)}
              >
                Închide toate sesiunile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nu există sesiuni active
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  {getDeviceIcon(session.device_info)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {getDeviceName(session.device_info)}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      Activă
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        Ultima activitate: {format(new Date(session.last_activity), "dd MMM yyyy, HH:mm", { locale: ro })}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Sesiune creată: {format(new Date(session.created_at), "dd MMM yyyy, HH:mm", { locale: ro })}
                  </p>
                  
                  <p className="text-xs text-muted-foreground">
                    Expiră: {format(new Date(session.expires_at), "dd MMM yyyy, HH:mm", { locale: ro })}
                  </p>
                  
                  {session.active_time_entry && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">
                        <strong>Pontaj activ:</strong>
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Intrare: {format(new Date(session.active_time_entry.clock_in_time), "HH:mm", { locale: ro })}</span>
                        {session.active_time_entry.clock_out_time && (
                          <>
                            <span>•</span>
                            <span>Ieșire: {format(new Date(session.active_time_entry.clock_out_time), "HH:mm", { locale: ro })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {session.active_time_entry?.clock_out_time && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const weekStart = format(
                          startOfWeek(new Date(session.active_time_entry!.clock_in_time), { weekStartsOn: 1 }),
                          'yyyy-MM-dd'
                        );
                        navigate(`/weekly-schedules?tab=verification&week=${weekStart}`);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-1" />
                      Verifică Pontaj
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLogoutSingle(session.session_id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showLogoutAll} onOpenChange={setShowLogoutAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Închide toate sesiunile?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va închide toate sesiunile active pe toate dispozitivele, 
              exceptând sesiunea curentă. Vei rămâne autentificat doar pe acest dispozitiv.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoutAll} className="bg-destructive hover:bg-destructive/90">
              Închide toate sesiunile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
