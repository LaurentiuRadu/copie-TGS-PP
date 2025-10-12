import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Clock, Calendar, AlertCircle, ChevronDown } from "lucide-react";
import { MigrationTestPanel } from "@/components/MigrationTestPanel";
import { TimeSegmentDebugPanel } from "@/components/TimeSegmentDebugPanel";

import { TardinessReportsManager } from "@/components/TardinessReportsManager";
import { TimeEntryCorrectionRequestsManager } from "@/components/TimeEntryCorrectionRequestsManager";
import { SuspiciousEntriesManager } from "@/components/SuspiciousEntriesManager";
import { VersionManager } from "@/components/VersionManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AutoCleanupExecutor } from "@/components/AutoCleanupExecutor";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const Admin = () => {
  const [toolsOpen, setToolsOpen] = useState(false);
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
        {/* 🔴 ALERTE & ACȚIUNI URGENTE */}
        {(pendingCount > 0) && (
          <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
                <AlertCircle className="h-5 w-5" />
                Atenție: {pendingCount} {pendingCount === 1 ? 'cerere' : 'cereri'} de corecție în așteptare
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <ErrorBoundary>
          <TimeEntryCorrectionRequestsManager />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <TardinessReportsManager />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <SuspiciousEntriesManager />
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

        {/* ⚙️ INSTRUMENTE TEHNICE (Collapsible) */}
        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    ⚙️ Instrumente Tehnice
                  </CardTitle>
                  <ChevronDown 
                    className={`h-5 w-5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`}
                  />
                </div>
                <CardDescription>
                  Migrări, debug și management versiuni
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-0">
                <AutoCleanupExecutor />
                <VersionManager />
                <TimeSegmentDebugPanel />
                <MigrationTestPanel />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
  );
};

export default Admin;
