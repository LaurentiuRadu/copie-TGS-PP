import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Clock, Calendar, AlertCircle } from "lucide-react";
import { TardinessReportsManager } from "@/components/TardinessReportsManager";
import { TimeEntryCorrectionRequestsManager } from "@/components/TimeEntryCorrectionRequestsManager";
import { SuspiciousEntriesManager } from "@/components/SuspiciousEntriesManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const Admin = () => {
  const isMobile = useIsMobile();
  const [isReprocessing, setIsReprocessing] = useState(false);

  // 🔧 Auto-reprocess old entries (9-11 octombrie) fără segmente
  useEffect(() => {
    const reprocessOldEntries = async () => {
      if (isReprocessing) return;
      
      try {
        setIsReprocessing(true);
        console.log('[Admin] Checking for old entries without segments...');
        
        // Verifică dacă există pontaje fără segmente din 9-11 octombrie
        const { data: entriesWithoutSegments, error: checkError } = await supabase
          .from('time_entries')
          .select('id, time_entry_segments(id)')
          .not('clock_out_time', 'is', null)
          .gte('clock_out_time', '2025-10-09T00:00:00Z')
          .lte('clock_out_time', '2025-10-11T23:59:59Z');

        if (checkError) throw checkError;

        const missingSegments = (entriesWithoutSegments || []).filter(
          e => !e.time_entry_segments || e.time_entry_segments.length === 0
        );

        if (missingSegments.length === 0) {
          console.log('[Admin] ✅ No old entries need reprocessing');
          return;
        }

        console.log(`[Admin] 🔧 Found ${missingSegments.length} old entries without segments, starting reprocess...`);
        
        toast.loading(`Reprocesare ${missingSegments.length} pontaje vechi...`, {
          id: 'reprocess-old-entries',
        });

        // Apelează edge function pentru reprocesare
        const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
          body: { mode: 'missing_segments', batch_size: 100 }
        });

        if (error) throw error;

        const results = data as { total: number; success: number; failed: number; batches?: number };
        
        console.log('[Admin] Reprocess results:', results);

        if (results.success > 0) {
          toast.success(
            `✅ Reprocesare completă: ${results.success}/${results.total} pontaje procesate`,
            {
              id: 'reprocess-old-entries',
              description: results.batches 
                ? `Procesate în ${results.batches} batch-uri${results.failed > 0 ? ` (${results.failed} eșuate)` : ''}`
                : results.failed > 0 
                  ? `${results.failed} pontaje au eșuat`
                  : undefined,
              duration: 5000,
            }
          );
        } else if (results.total === 0) {
          toast.info('Toate pontajele au fost deja procesate', {
            id: 'reprocess-old-entries',
          });
        } else {
          toast.error(`Reprocesarea a eșuat pentru ${results.failed} pontaje`, {
            id: 'reprocess-old-entries',
            description: 'Verifică logurile pentru detalii',
            duration: 5000,
          });
        }

      } catch (error: any) {
        console.error('[Admin] Reprocess error:', error);
        toast.error('Eroare la reprocesare automată', {
          id: 'reprocess-old-entries',
          description: error.message,
        });
      } finally {
        setIsReprocessing(false);
      }
    };

    // Rulează o singură dată la mount, cu un delay de 2 secunde
    const timer = setTimeout(() => {
      reprocessOldEntries();
    }, 2000);

    return () => clearTimeout(timer);
  }, []); // Empty deps = run once on mount

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
      </div>
  );
};

export default Admin;
