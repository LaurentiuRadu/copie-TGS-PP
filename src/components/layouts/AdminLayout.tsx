import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ScheduleNotificationBell } from "@/components/ScheduleNotificationBell";
import { UpdateBadge } from "@/components/UpdateBadge";
import { PasswordExpiryBanner } from "@/components/PasswordExpiryBanner";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  headerActions?: ReactNode;
  showLogout?: boolean;
}

export const AdminLayout = ({ 
  children, 
  title, 
  headerActions, 
  showLogout = true 
}: AdminLayoutProps) => {
  const { signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="glass-nav sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-primary/10 shadow-elegant backdrop-blur-xl animate-slide-down px-4 md:px-6">
            <SidebarTrigger className="touch-target-lg" />
            {title && (
              <div className="flex-1">
                <h1 className="text-lg md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {title}
                </h1>
              </div>
            )}
            {!title && <div className="flex-1" />}
            <div className="flex items-center gap-2 md:gap-3">
              {headerActions}
              <UpdateBadge />
              <ScheduleNotificationBell />
              {showLogout && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={signOut}
                  className="gap-2 glass-button hover:border-destructive hover:text-destructive transition-all duration-200 touch-target-lg flex-shrink-0"
                >
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Deconectare</span>
                </Button>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6">
              <PasswordExpiryBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
