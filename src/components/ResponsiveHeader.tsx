import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut } from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScheduleNotificationBell } from "@/components/ScheduleNotificationBell";

interface ResponsiveHeaderProps {
  title: string;
  children?: ReactNode;
  showSearch?: boolean;
}

export function ResponsiveHeader({ title, children, showSearch = false }: ResponsiveHeaderProps) {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b border-border/50 bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 px-3 md:px-6 shadow-sm">
      {/* Desktop Sidebar Toggle */}
      <div className="hidden lg:block">
        <SidebarTrigger />
      </div>

      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Menu</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {/* Navigation items will be injected here */}
            </div>
            <div className="p-4 border-t">
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Deconectare
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
          {title}
        </h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <ScheduleNotificationBell />
        {children}
      </div>
    </header>
  );
}
