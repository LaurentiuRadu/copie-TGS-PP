import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, CheckCircle2, FolderOpen } from "lucide-react";

const stats = [
  {
    title: "Ore astăzi",
    value: "6h 32m",
    change: "+12%",
    icon: Clock,
    trend: "up",
  },
  {
    title: "Task-uri finalizate",
    value: "24",
    change: "+8 față de ieri",
    icon: CheckCircle2,
    trend: "up",
  },
  {
    title: "Proiecte active",
    value: "8",
    change: "2 deadline-uri apropiate",
    icon: FolderOpen,
    trend: "neutral",
  },
  {
    title: "Productivitate",
    value: "94%",
    change: "+5% față de săptămâna trecută",
    icon: TrendingUp,
    trend: "up",
  },
];

export function DashboardStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="shadow-custom-sm hover:shadow-custom-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
