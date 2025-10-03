import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/50 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60 px-6 shadow-sm">
            <SidebarTrigger />
            {title && (
              <div className="flex-1">
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {title}
                </h1>
              </div>
            )}
            {!title && <div className="flex-1" />}
            <div className="flex items-center gap-3">
              {headerActions}
              {showLogout && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={signOut}
                  className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">Deconectare</span>
                </Button>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
