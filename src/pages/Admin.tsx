import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Clock, Calendar, AlertCircle, ChevronDown } from "lucide-react";
import { MigrationTestPanel } from "@/components/MigrationTestPanel";
import { TimeSegmentDebugPanel } from "@/components/TimeSegmentDebugPanel";
import { AdminLayout } from "@/components/AdminLayout";
import { TardinessReportsManager } from "@/components/TardinessReportsManager";
import { HistoricalDataMigration } from "@/components/HistoricalDataMigration";
import { TimeEntryCorrectionRequestsManager } from "@/components/TimeEntryCorrectionRequestsManager";
import { SuspiciousEntriesManager } from "@/components/SuspiciousEntriesManager";
import { VersionManager } from "@/components/VersionManager";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const Admin = () => {
  const [toolsOpen, setToolsOpen] = useState(false);

  // Fetch pending correction requests count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['correctionRequestsPendingCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('time_entry_correction_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Fetch total employees
  const { data: totalEmployees = 0 } = useQuery({
    queryKey: ['totalEmployees'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch active today (clocked in, not clocked out)
  const { data: activeToday = 0 } = useQuery({
    queryKey: ['activeToday'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .gte('clock_in_time', `${today}T00:00:00`)
        .is('clock_out_time', null);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Fetch pending vacation requests
  const { data: pendingVacations = 0 } = useQuery({
    queryKey: ['pendingVacations'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('vacation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Fetch average hours per day (current week)
  const { data: avgHours = 0 } = useQuery({
    queryKey: ['avgHoursCurrentWeek'],
    queryFn: async () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      const startDate = startOfWeek.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_timesheets')
        .select('hours_regular, hours_night, work_date')
        .gte('work_date', startDate);
      
      if (error) throw error;
      if (!data || data.length === 0) return 0;

      const totalHours = data.reduce((sum, entry) => 
        sum + (entry.hours_regular || 0) + (entry.hours_night || 0), 0
      );
      const uniqueDays = new Set(data.map(entry => entry.work_date)).size;
      return uniqueDays > 0 ? (totalHours / uniqueDays).toFixed(1) : 0;
    },
  });

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="p-6 space-y-6">
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

        <TimeEntryCorrectionRequestsManager />
        <TardinessReportsManager />
        <SuspiciousEntriesManager />

        {/* 📊 STATISTICI REALE */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Angajați</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Activi în sistem</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-success/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activi Astăzi</CardTitle>
              <Clock className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeToday}</div>
              <p className="text-xs text-muted-foreground">Pontați în prezent</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cereri Concediu</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingVacations}</div>
              <p className="text-xs text-muted-foreground">În așteptare aprobare</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-info/20">
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
                <VersionManager />
                <HistoricalDataMigration />
                <TimeSegmentDebugPanel />
                <MigrationTestPanel />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AdminLayout>
  );
};

export default Admin;
