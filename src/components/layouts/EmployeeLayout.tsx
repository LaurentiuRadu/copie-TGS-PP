import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ScheduleNotificationBell } from "@/components/ScheduleNotificationBell";
import { RomaniaTimeClock } from "@/components/RomaniaTimeClock";
import { UpdateBadge } from "@/components/UpdateBadge";
import { PasswordExpiryBanner } from "@/components/PasswordExpiryBanner";

interface EmployeeLayoutProps {
  children: ReactNode;
  title?: string;
  headerActions?: ReactNode;
  showLogout?: boolean;
}

export const EmployeeLayout = ({ 
  children, 
  title, 
  headerActions, 
  showLogout = true 
}: EmployeeLayoutProps) => {
  const { signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="glass-nav sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-primary/10 shadow-elegant backdrop-blur-xl animate-slide-down px-2 md:px-4">
            <SidebarTrigger className="h-8 w-8" />
            <RomaniaTimeClock />
            {title && (
              <div className="flex-1 min-w-0">
                <h1 className="text-sm md:text-lg font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
                  {title}
                </h1>
              </div>
            )}
            {!title && <div className="flex-1" />}
            <div className="flex items-center gap-1.5 md:gap-2">
              {headerActions}
              <UpdateBadge />
              <ScheduleNotificationBell />
              {showLogout && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={signOut}
                  className="gap-1.5 glass-button hover:border-destructive hover:text-destructive transition-all duration-200 h-8 px-2 md:px-3"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden md:inline text-xs">Deconectare</span>
                </Button>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="p-2 md:p-4">
              <PasswordExpiryBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
