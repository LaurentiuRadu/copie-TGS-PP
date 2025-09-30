import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Menu, Clock, CheckCircle2, FolderOpen, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user, signOut } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Check location permission on mount
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationEnabled(true);
          setLocationError(null);
        },
        (error) => {
          setLocationEnabled(false);
          setLocationError("Locația trebuie activată pentru a folosi aplicația");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      // Watch location changes
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocationEnabled(true);
          setLocationError(null);
        },
        (error) => {
          setLocationEnabled(false);
          setLocationError("Locația trebuie activată pentru a folosi aplicația");
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationEnabled(false);
      setLocationError("Dispozitivul nu suportă locația");
    }
  }, []);

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

  const BREAK_MINUTES = 30;
  const todayTotalMinutes = 392; // Example: 6h 32m = 392 minutes
  const todayWorkedMinutes = Math.max(0, todayTotalMinutes - BREAK_MINUTES);
  const todayHours = `${Math.floor(todayWorkedMinutes / 60)}h ${todayWorkedMinutes % 60}m`;

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
              <p className="text-xs text-muted-foreground">{user?.user_metadata?.full_name || user?.email}</p>
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
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                  Deconectare
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Location Warning */}
        {!locationEnabled && locationError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{locationError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today Stats */}
        <Card className="bg-gradient-primary">
          <CardContent className="p-6">
            <div className="text-white/80 text-sm mb-1">Ore astăzi</div>
            <div className="text-4xl font-bold text-white">{todayHours}</div>
            <div className="text-white/60 text-xs mt-2">
              (Include deducerea automată a pauzei de 30 min)
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!locationEnabled}
                className="h-14 text-base bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                INTRARE CONDUS
              </Button>
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!locationEnabled}
                className="h-14 text-base bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                INTRARE PASAGER
              </Button>
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!locationEnabled}
                className="h-14 text-base bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                INTRARE
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleStop}
                disabled={!locationEnabled}
                className="h-14 text-base"
              >
                IEȘIRE
              </Button>
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
