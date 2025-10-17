import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, TrendingUp, Clock, Calendar, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { TimeEntryCorrectionRequestsManager } from "@/components/TimeEntryCorrectionRequestsManager";
import { SuspiciousEntriesManager } from "@/components/SuspiciousEntriesManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApprovalStatsDashboard } from "@/components/ApprovalStatsDashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SecurityAlertsManager } from "@/components/SecurityAlertsManager";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const Admin = () => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isReprocessDialogOpen, setIsReprocessDialogOpen] = useState(false);

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

  // 🔄 Mutation pentru recalculare segmente (întreaga bază de date)
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
        body: { 
          mode: 'needs_reprocessing', // Procesează doar pontajele cu flag
          batch_size: 100
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suspicious-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast({
        title: '✅ Recalculare finalizată',
        description: `${data.success}/${data.total} pontaje procesate cu succes`,
      });
      setIsReprocessDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '❌ Eroare recalculare',
        description: error.message,
      });
    },
  });

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

        {/* 🛠️ ADMIN TOOLS - Recalculare Segmente */}
        <Card className="border-warning/30 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-warning" />
                  Instrumente Administrative
                </CardTitle>
                <CardDescription className="mt-2">
                  Operațiuni de mentenanță pentru toată baza de date
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">Recalculează Segmente pentru Toată Baza</h4>
                  <p className="text-xs text-muted-foreground">
                    Procesează toate pontajele cu <code className="px-1 py-0.5 bg-muted rounded text-xs">needs_reprocessing = true</code> și recalculează segmentele de timp.
                  </p>
                  <p className="text-xs text-warning/80 mt-2">
                    ⚠️ Această operațiune poate dura câteva minute pentru volume mari de date.
                  </p>
                </div>
                
                <AlertDialog open={isReprocessDialogOpen} onOpenChange={setIsReprocessDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-warning/40 hover:bg-warning/10"
                      disabled={reprocessMutation.isPending}
                    >
                      {reprocessMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Se procesează...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Recalculează
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Recalculare Segmente - Confirmare</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Această acțiune va recalcula segmentele de timp pentru <strong>toate pontajele marcate cu needs_reprocessing = true</strong>.
                        </p>
                        <p className="text-warning">
                          ⚠️ Procesarea poate dura câteva minute. Nu închide pagina până la finalizare.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Segmentele vor fi recalculate automat bazat pe:
                        </p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                          <li>Ora de intrare/ieșire</li>
                          <li>Tipul de schimb (Normal/Noapte)</li>
                          <li>Zile libere și sărbători legale</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anulează</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => reprocessMutation.mutate()}
                        className="bg-warning hover:bg-warning/90"
                      >
                        Da, Recalculează
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

export default Admin;
