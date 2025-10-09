import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSearchCommand } from "@/components/AdminSearchCommand";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, actions }: AdminLayoutProps) {
  const { signOut } = useAuth();
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className={cn(
        "flex min-h-screen w-full",
        isMobile 
          ? "admin-mobile-theme" 
          : "bg-gradient-to-br from-background via-background to-muted/20"
      )}>
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className={cn(
            "sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/50 px-6",
            isMobile 
              ? "bg-card/90 backdrop-blur-xl shadow-lg" 
              : "bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60 shadow-sm"
          )}>
            <SidebarTrigger />
            {title && (
              <div className="flex-1">
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {title}
                </h1>
              </div>
            )}
            <div className="flex items-center gap-3 ml-auto">
              {actions}
              <AdminSearchCommand />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={signOut}
                className="gap-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Deconectare</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
