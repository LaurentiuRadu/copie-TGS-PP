import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Menu, Clock, CheckCircle2, FolderOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const tasks = [
  {
    id: 1,
    title: "Review cod pentru PR #234",
    project: "Backend API",
    status: "in-progress",
  },
  {
    id: 2,
    title: "Design mockup pagină login",
    project: "Frontend UI",
    status: "pending",
  },
  {
    id: 3,
    title: "Testing feature autentificare",
    project: "QA",
    status: "pending",
  },
];

const projects = [
  { id: 1, name: "Redesign Website", client: "Acme Corp" },
  { id: 2, name: "Mobile App Development", client: "TechStart" },
  { id: 3, name: "API Integration", client: "DataFlow Inc" },
];

const Mobile = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedTask, setSelectedTask] = useState<number | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    if (selectedTask === null) {
      alert("Te rog selectează un task!");
      return;
    }
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);
  
  const handleStop = () => {
    setIsRunning(false);
    setSeconds(0);
    setSelectedTask(null);
  };

  const todayHours = "6h 32m";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">TimeTrack</h1>
              <p className="text-xs text-muted-foreground">Alex Popescu</p>
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Meniu</SheetTitle>
                <SheetDescription>Opțiuni disponibile</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Clock className="h-4 w-4" />
                  Istoric Timp
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Task-uri
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Proiecte
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Today Stats */}
        <Card className="bg-gradient-primary">
          <CardContent className="p-6">
            <div className="text-white/80 text-sm mb-1">Ore astăzi</div>
            <div className="text-4xl font-bold text-white">{todayHours}</div>
          </CardContent>
        </Card>

        {/* Timer Card */}
        <Card className="shadow-lg">
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-4">
              <div className="text-6xl font-bold text-foreground tracking-wider">
                {formatTime(seconds)}
              </div>
              
              {selectedTask !== null && (
                <div className="px-4 py-2 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Task activ:</div>
                  <div className="font-medium text-foreground text-sm">
                    {tasks.find(t => t.id === selectedTask)?.title}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              {!isRunning ? (
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="flex-1 h-14 text-lg bg-gradient-primary hover:opacity-90 gap-2"
                >
                  <Play className="h-6 w-6" />
                  Start
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={handlePause}
                    className="flex-1 h-14 text-lg gap-2"
                  >
                    <Pause className="h-6 w-6" />
                    Pauză
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStop}
                    className="h-14 px-6 gap-2"
                  >
                    <Square className="h-5 w-5" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Selectează Task</h2>
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all ${
                selectedTask === task.id
                  ? "border-primary border-2 shadow-md"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => !isRunning && setSelectedTask(task.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground mb-1">{task.title}</div>
                    <div className="text-sm text-muted-foreground">{task.project}</div>
                  </div>
                  {selectedTask === task.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Proiectele Mele</h2>
          {projects.map((project) => (
            <Card key={project.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{project.name}</div>
                    <div className="text-sm text-muted-foreground">{project.client}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Mobile;
