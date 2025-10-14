import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, TrendingUp, Clock, Calendar, AlertCircle } from "lucide-react";
import { TimeEntryCorrectionRequestsManager } from "@/components/TimeEntryCorrectionRequestsManager";
import { SuspiciousEntriesManager } from "@/components/SuspiciousEntriesManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApprovalStatsDashboard } from "@/components/ApprovalStatsDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SecurityAlertsManager } from "@/components/SecurityAlertsManager";

const Admin = () => {
  const isMobile = useIsMobile();


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

        <SecurityAlertsManager />
    </div>
  );
};

export default Admin;
