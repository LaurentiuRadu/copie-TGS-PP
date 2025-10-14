import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp, Award, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import heroImage from "@/assets/hero-team.jpg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Query pentru alerte securitate nerezolvate
  const { data: unresolvedAlertsCount = 0 } = useQuery({
    queryKey: ['unresolved-alerts-count-dashboard'],
    queryFn: async () => {
      const { count } = await supabase
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);
      
      return count || 0;
    },
    refetchInterval: 30000, // 30s
  });

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

                <Card 
                  className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" 
                  onClick={() => navigate('/alerts')}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="hidden sm:inline">Alerte Securitate</span>
                      <span className="sm:hidden">Alerte</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-destructive">{unresolvedAlertsCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">Nerezolvate</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
