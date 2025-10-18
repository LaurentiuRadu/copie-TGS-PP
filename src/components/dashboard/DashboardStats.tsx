import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, Calendar, FileEdit, TrendingUp, AlertCircle } from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const DashboardStats = () => {
  const { data: stats, isLoading, error } = useAdminStats();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Nu s-au putut încărca statisticile. Reîncercă mai târziu.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Angajați",
      value: stats?.totalEmployees || 0,
      subtitle: "Total activi",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "În Pontaj",
      value: stats?.activeToday || 0,
      subtitle: "Azi",
      icon: Clock,
      color: "text-success",
    },
    {
      title: "Concedii",
      value: stats?.pendingVacations || 0,
      subtitle: "Cereri pending",
      icon: Calendar,
      color: "text-warning",
    },
    {
      title: "Corecții",
      value: stats?.pendingCorrections || 0,
      subtitle: "De verificat",
      icon: FileEdit,
      color: "text-info",
    },
    {
      title: "Medie Ore",
      value: `${stats?.avgHours || '0'}h`,
      subtitle: "Săptămâna asta",
      icon: TrendingUp,
      color: "text-chart-1",
    },
  ];

  return (
    <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
      {statCards.map((stat, index) => (
        <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="hidden sm:inline">{stat.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
