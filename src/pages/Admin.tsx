import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardStats } from "@/components/DashboardStats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Download, Filter, Plus, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const employees = [
  {
    id: 1,
    name: "Ion Ionescu",
    role: "Developer",
    hoursToday: "7h 30m",
    hoursWeek: "38h 45m",
    status: "active",
    currentTask: "API Integration",
  },
  {
    id: 2,
    name: "Maria Popescu",
    role: "Designer",
    hoursToday: "6h 15m",
    hoursWeek: "32h 20m",
    status: "active",
    currentTask: "UI Mockups",
  },
  {
    id: 3,
    name: "Andrei Gheorghe",
    role: "Developer",
    hoursToday: "5h 45m",
    hoursWeek: "29h 10m",
    status: "break",
    currentTask: "Testing",
  },
  {
    id: 4,
    name: "Elena Vasilescu",
    role: "Project Manager",
    hoursToday: "8h 00m",
    hoursWeek: "40h 00m",
    status: "active",
    currentTask: "Client Meeting",
  },
  {
    id: 5,
    name: "Alexandru Dumitru",
    role: "Developer",
    hoursToday: "0h 00m",
    hoursWeek: "35h 30m",
    status: "offline",
    currentTask: "-",
  },
];

const recentActivities = [
  {
    id: 1,
    employee: "Ion Ionescu",
    action: "A început lucrul la",
    task: "API Integration",
    time: "Acum 15 min",
  },
  {
    id: 2,
    employee: "Maria Popescu",
    action: "A finalizat",
    task: "Design Homepage",
    time: "Acum 32 min",
  },
  {
    id: 3,
    employee: "Andrei Gheorghe",
    action: "A luat pauză",
    task: "-",
    time: "Acum 1h",
  },
  {
    id: 4,
    employee: "Elena Vasilescu",
    action: "A început lucrul la",
    task: "Client Meeting",
    time: "Acum 2h",
  },
];

const Admin = () => {
  const { signOut } = useAuth();
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success">Activ</Badge>;
      case "break":
        return <Badge className="bg-warning/10 text-warning">Pauză</Badge>;
      case "offline":
        return <Badge variant="outline">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtrează
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button size="sm" className="gap-2 bg-gradient-primary">
                <Plus className="h-4 w-4" />
                Angajat Nou
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Deconectare
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stats Overview */}
            <DashboardStats />

            {/* Team Overview Card */}
            <Card className="shadow-custom-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Echipa - Monitorizare Timp Real
                    </CardTitle>
                    <CardDescription>Status și activitate angajați</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Angajat</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ore Astăzi</TableHead>
                      <TableHead>Ore Săptămână</TableHead>
                      <TableHead>Task Curent</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell className="text-muted-foreground">{employee.role}</TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                        <TableCell>{employee.hoursToday}</TableCell>
                        <TableCell>{employee.hoursWeek}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {employee.currentTask}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            Detalii
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Activity */}
              <Card className="shadow-custom-sm">
                <CardHeader>
                  <CardTitle>Activitate Recentă</CardTitle>
                  <CardDescription>Ultimele acțiuni ale echipei</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground">
                            <span className="font-medium">{activity.employee}</span>{" "}
                            {activity.action}{" "}
                            {activity.task !== "-" && (
                              <span className="font-medium">{activity.task}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="shadow-custom-sm">
                <CardHeader>
                  <CardTitle>Statistici Rapide</CardTitle>
                  <CardDescription>Rezumat săptămâna curentă</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <div className="text-sm text-muted-foreground">Total ore lucrate</div>
                        <div className="text-2xl font-bold text-foreground">175h 45m</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <div className="text-sm text-muted-foreground">Angajați activi</div>
                        <div className="text-2xl font-bold text-foreground">4 / 5</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <div className="text-sm text-muted-foreground">Task-uri finalizate</div>
                        <div className="text-2xl font-bold text-foreground">47</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <div className="text-sm text-muted-foreground">Productivitate medie</div>
                        <div className="text-2xl font-bold text-foreground">92%</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Admin;
