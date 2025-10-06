import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { RomaniaTimeClock } from "./RomaniaTimeClock";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScheduleNotificationBell } from "./ScheduleNotificationBell";
import { useAuth } from "@/contexts/AuthContext";

interface AppHeaderProps {
  userName?: string;
  showBackButton?: boolean;
  children?: React.ReactNode;
}

export const AppHeader = ({ userName, showBackButton = false, children }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Show back button only when not on main mobile page
  const shouldShowBack = showBackButton || location.pathname !== '/mobile';

  return (
    <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border shadow-sm">
      <div className="flex items-center justify-between p-3 xs:p-4 gap-3">
        {/* Left: Menu or Back button */}
        <div className="flex items-center gap-2 w-20 justify-center">
          {shouldShowBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-20 w-20 flex-shrink-0"
              title="Înapoi"
            >
              <ArrowLeft className="h-8 w-8" />
            </Button>
          ) : (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-20 w-20 flex-shrink-0">
                  <Menu className="h-8 w-8" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                {children}
              </SheetContent>
            </Sheet>
          )}
        </div>
        
        {/* Center: Clock, Date, and User Name */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 gap-1">
          <RomaniaTimeClock />
          {userName && (
            <span className="text-sm text-muted-foreground truncate max-w-full font-medium">
              {userName}
            </span>
          )}
        </div>
        
        {/* Right: Notifications */}
        <div className="flex items-center gap-2 w-20 justify-center">
          <ScheduleNotificationBell />
        </div>
      </div>
    </header>
  );
};
