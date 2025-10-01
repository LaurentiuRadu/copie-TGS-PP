import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square } from "lucide-react";

export function ActiveTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleStop = () => {
    setIsRunning(false);
    setSeconds(0);
  };

  return (
    <Card className="shadow-custom-md animate-fade-in hover-scale">
      <CardHeader>
        <CardTitle>Time Tracker Activ</CardTitle>
        <CardDescription>Înregistrează timpul lucrat pentru task-uri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center">
          <div className="text-6xl font-bold text-foreground tracking-wider animate-fade-in">
            {formatTime(seconds)}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          {!isRunning ? (
            <Button
              size="lg"
              onClick={handleStart}
              className="bg-gradient-primary hover:opacity-90 gap-2"
            >
              <Play className="h-5 w-5" />
              Start
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              onClick={handlePause}
              className="gap-2"
            >
              <Pause className="h-5 w-5" />
              Pauză
            </Button>
          )}
          
          <Button
            size="lg"
            variant="outline"
            onClick={handleStop}
            disabled={seconds === 0}
            className="gap-2"
          >
            <Square className="h-5 w-5" />
            Stop
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground mb-2">Task actual:</div>
          <div className="font-medium text-foreground">Dezvoltare feature nou - Dashboard</div>
        </div>
      </CardContent>
    </Card>
  );
}
