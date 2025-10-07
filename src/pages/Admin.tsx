import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Download, Filter, Plus, TrendingUp, Clock, Calendar } from "lucide-react";
import { MigrationTestPanel } from "@/components/MigrationTestPanel";
import { TimeSegmentDebugPanel } from "@/components/TimeSegmentDebugPanel";
import { AdminLayout } from "@/components/AdminLayout";
import { TardinessReportsManager } from "@/components/TardinessReportsManager";
import { HistoricalDataMigration } from "@/components/HistoricalDataMigration";

const Admin = () => {
  return (
    <AdminLayout title="Admin Dashboard">
      <div className="p-6 space-y-6">
            {/* Historical Data Migration - Pas 5 */}
            <HistoricalDataMigration />
            
            {/* Time Segment Debug Panel */}
            <TimeSegmentDebugPanel />
            
            {/* Migration Test Panel */}
            <MigrationTestPanel />

            {/* Tardiness Reports Manager */}
            <TardinessReportsManager />

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Angajați</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Activi în sistem
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-success/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prezenti Astăzi</CardTitle>
                  <Clock className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Pontați în prezent
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-warning/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cereri Concediu</CardTitle>
                  <Calendar className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    În așteptare aprobare
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300 bg-gradient-card border-info/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Performanță</CardTitle>
                  <TrendingUp className="h-4 w-4 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Media ore lucrate/zi
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Team Overview Card */}
            <Card className="shadow-elegant border-primary/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-glass opacity-50 pointer-events-none" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Users className="h-6 w-6 text-primary" />
                      Echipa - Monitorizare Timp Real
                    </CardTitle>
                    <CardDescription className="mt-1">Status și activitate angajați</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2 hover:bg-accent transition-all">
                      <Filter className="h-4 w-4" />
                      Filtrează
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 hover:bg-accent transition-all">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                    <Button size="sm" className="gap-2 bg-gradient-primary shadow-md hover:shadow-lg transition-all">
                      <Plus className="h-4 w-4" />
                      Angajat Nou
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">Nu există date disponibile</p>
                  <p className="text-sm mt-1">Datele vor apărea aici când angajații încep să ponteze</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Activity */}
              <Card className="shadow-custom-md border-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">Activitate Recentă</CardTitle>
                  <CardDescription>Ultimele acțiuni ale echipei</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>Nu există activități recente</p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="shadow-custom-md border-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">Statistici Rapide</CardTitle>
                  <CardDescription>Rezumat săptămâna curentă</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>Nu există date disponibile</p>
                  </div>
                </CardContent>
              </Card>
            </div>
      </div>
    </AdminLayout>
  );
};

export default Admin;
