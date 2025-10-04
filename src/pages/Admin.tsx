import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Download, Filter, Plus, TrendingUp, Clock, Calendar, RefreshCw } from "lucide-react";
import { AdminSearchCommand } from "@/components/AdminSearchCommand";
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const navigate = useNavigate();

  return (
    <AdminLayout
      title="Admin Dashboard"
      headerActions={<AdminSearchCommand />}
    >
      <div className="p-4 md:p-6 space-y-8 bg-mesh min-h-full animate-slide-up-fade">
            {/* Stats Cards */}
            <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="glass-card elevated-card shadow-glow hover:scale-105 transition-all duration-300 animate-slide-up-fade touch-target-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Angajați</CardTitle>
                  <Users className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-foreground">-</div>
                  <p className="text-xs text-muted-foreground">
                    Activi în sistem
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card elevated-card shadow-glow hover:scale-105 transition-all duration-300 animate-slide-up-fade touch-target-lg" style={{ animationDelay: '100ms' }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prezenti Astăzi</CardTitle>
                  <Clock className="h-5 w-5 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-success glow-accent">-</div>
                  <p className="text-xs text-muted-foreground">
                    Pontați în prezent
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card elevated-card shadow-glow hover:scale-105 transition-all duration-300 animate-slide-up-fade touch-target-lg" style={{ animationDelay: '200ms' }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cereri Concediu</CardTitle>
                  <Calendar className="h-5 w-5 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-warning">-</div>
                  <p className="text-xs text-muted-foreground">
                    În așteptare aprobare
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card elevated-card shadow-glow hover:scale-105 transition-all duration-300 animate-slide-up-fade touch-target-lg" style={{ animationDelay: '300ms' }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Performanță</CardTitle>
                  <TrendingUp className="h-5 w-5 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-bold text-info">-</div>
                  <p className="text-xs text-muted-foreground">
                    Media ore lucrate/zi
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Team Overview Card */}
            <Card className="glass-card animate-scale-in overflow-hidden">
              <CardHeader>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl md:text-2xl bg-gradient-primary bg-clip-text text-transparent font-bold">
                      <Users className="h-6 w-6 text-primary" />
                      Echipa - Monitorizare Timp Real
                    </CardTitle>
                    <CardDescription className="mt-1 text-base">Status și activitate angajați</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="glass-button gap-2 touch-target-lg">
                      <Filter className="h-4 w-4" />
                      Filtrează
                    </Button>
                    <Button variant="outline" size="sm" className="glass-button gap-2 touch-target-lg">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => navigate('/user-management')}
                      className="gap-2 bg-gradient-primary-action shadow-glow hover:shadow-elegant touch-target-lg"
                    >
                      <Plus className="h-4 w-4" />
                      Angajat Nou
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="glass-card p-8 md:p-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-3 text-primary animate-float" />
                  <p className="text-base md:text-lg font-medium">Nu există date disponibile</p>
                  <p className="text-sm text-muted-foreground mt-1">Datele vor apărea aici când angajații încep să ponteze</p>
                </div>
              </CardContent>
            </Card>

            {/* System Tools */}
            <Card className="glass-card border-warning/20 shadow-soft animate-scale-in">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl flex items-center gap-2 text-warning font-semibold">
                  <RefreshCw className="h-5 w-5" />
                  Instrumente Sistem
                </CardTitle>
                <CardDescription className="text-base">
                  Tool-uri administrative pentru mentenanță și recalculare
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate('/recalculate-segments')}
                  variant="outline"
                  className="w-full justify-start gap-2 glass-button border-warning/30 hover:border-warning touch-target-lg"
                >
                  <RefreshCw className="h-4 w-4 text-warning" />
                  Recalculează Segments Pontaje
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Recent Activity */}
              <Card className="glass-card elevated-card animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl font-semibold">Activitate Recentă</CardTitle>
                  <CardDescription className="text-base">Ultimele acțiuni ale echipei</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="glass-card p-8 md:p-12 text-center">
                    <Clock className="h-10 w-10 mx-auto mb-3 text-primary opacity-50" />
                    <p className="text-muted-foreground text-sm md:text-base">Nu există activități recente</p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="glass-card elevated-card animate-fade-in" style={{ animationDelay: '100ms' }}>
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl font-semibold">Statistici Rapide</CardTitle>
                  <CardDescription className="text-base">Rezumat săptămâna curentă</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="glass-card p-8 md:p-12 text-center">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 text-info opacity-50" />
                    <p className="text-muted-foreground text-sm md:text-base">Nu există date disponibile</p>
                  </div>
                </CardContent>
              </Card>
            </div>
      </div>
    </AdminLayout>
  );
};

export default Admin;
