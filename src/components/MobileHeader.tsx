import { Button } from "@/components/ui/button";
import { Menu, LogOut, Clock, CheckCircle2, FolderOpen, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useNavigate } from 'react-router-dom';
import { ScheduleNotificationBell } from "@/components/ScheduleNotificationBell";
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface MobileHeaderProps {
  safeAreaTop: number;
}

export const MobileHeader = ({ safeAreaTop }: MobileHeaderProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header 
      className="sticky top-0 z-20 glass-nav shadow-elegant animate-slide-down"
      style={{ paddingTop: `${safeAreaTop}px` }}
    >
      <div className="flex flex-col">
        {/* Rândul 1: Logo, User și Controale */}
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          {/* Meniu stânga cu TimeTrack deasupra */}
          <div className="flex flex-col items-start gap-1 flex-shrink-0">
            <h1 className="text-xl font-bold text-foreground">TimeTrack</h1>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 touch-target no-select">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Meniu</SheetTitle>
                  <SheetDescription>Opțiuni disponibile</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <SheetClose asChild>
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/my-time-entries')}>
                      <Clock className="h-4 w-4" />
                      Istoric Timp
                    </Button>
                  </SheetClose>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Task-uri
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Proiecte
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/vacations')}>
                    <CalendarDays className="h-4 w-4" />
                    Concedii
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

          {/* Ceas + Data + User centru */}
          <div className="flex flex-col items-center text-center flex-1 min-w-0 gap-1">
            <span className="text-xl font-bold tabular-nums tracking-tight">
              {format(new Date(), 'HH:mm:ss')}
            </span>
            <span className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: ro })}
            </span>
            <p className="text-sm text-foreground truncate max-w-full">
              {user?.user_metadata?.full_name || user?.email}
            </p>
          </div>
          
          {/* Notificări dreapta */}
          <div className="flex-shrink-0">
            <ScheduleNotificationBell />
          </div>
        </div>
      </div>
    </header>
  );
};
