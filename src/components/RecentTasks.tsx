import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const tasks = [
  {
    id: 1,
    title: "Review cod pentru PR #234",
    project: "Backend API",
    status: "completed",
    time: "2h 15m",
  },
  {
    id: 2,
    title: "Design mockup pagină login",
    project: "Frontend UI",
    status: "in-progress",
    time: "1h 30m",
  },
  {
    id: 3,
    title: "Meeting cu echipa",
    project: "Management",
    status: "completed",
    time: "45m",
  },
  {
    id: 4,
    title: "Documentație API endpoints",
    project: "Backend API",
    status: "pending",
    time: "0m",
  },
  {
    id: 5,
    title: "Testing feature autentificare",
    project: "QA",
    status: "in-progress",
    time: "3h 20m",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Finalizat
        </Badge>
      );
    case "in-progress":
      return (
        <Badge className="bg-info/10 text-info hover:bg-info/20 gap-1">
          <Clock className="h-3 w-3" />
          În lucru
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Circle className="h-3 w-3" />
          Pending
        </Badge>
      );
  }
};

export function RecentTasks() {
  return (
    <Card className="shadow-custom-sm">
      <CardHeader>
        <CardTitle>Task-uri Recente</CardTitle>
        <CardDescription>Activitățile tale din ultima săptămână</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground mb-1">{task.title}</div>
                <div className="text-sm text-muted-foreground">{task.project}</div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="text-sm font-medium text-muted-foreground">{task.time}</div>
                {getStatusBadge(task.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
