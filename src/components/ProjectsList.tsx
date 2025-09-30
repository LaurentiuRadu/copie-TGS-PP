import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FolderOpen } from "lucide-react";

const projects = [
  {
    id: 1,
    name: "Redesign Website",
    client: "Acme Corp",
    progress: 75,
    hoursLogged: "124h",
    totalHours: "160h",
  },
  {
    id: 2,
    name: "Mobile App Development",
    client: "TechStart",
    progress: 45,
    hoursLogged: "68h",
    totalHours: "150h",
  },
  {
    id: 3,
    name: "API Integration",
    client: "DataFlow Inc",
    progress: 90,
    hoursLogged: "89h",
    totalHours: "100h",
  },
  {
    id: 4,
    name: "Dashboard Analytics",
    client: "Metrics Co",
    progress: 30,
    hoursLogged: "36h",
    totalHours: "120h",
  },
];

export function ProjectsList() {
  return (
    <Card className="shadow-custom-sm">
      <CardHeader>
        <CardTitle>Proiecte Active</CardTitle>
        <CardDescription>Progresul proiectelor curente</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {projects.map((project) => (
            <div key={project.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{project.name}</div>
                    <div className="text-sm text-muted-foreground">{project.client}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">{project.progress}%</div>
                  <div className="text-xs text-muted-foreground">
                    {project.hoursLogged} / {project.totalHours}
                  </div>
                </div>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
