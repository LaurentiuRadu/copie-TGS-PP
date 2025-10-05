import { Home, Clock, BarChart3, Calendar, Users, Settings, MapPin, ClipboardList, FileText, AlertTriangle, Shield, UserCog, CalendarDays, Table, RefreshCw } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { forceRefreshApp, isIOSPWA } from "@/lib/iosPwaUpdate";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

// Meniuri pentru Admin
const adminMenuItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Gestionare Utilizatori", url: "/user-management", icon: UserCog },
  { title: "Pontaje Detaliate", url: "/time-entries", icon: ClipboardList },
  { title: "Timesheet", url: "/timesheet", icon: Table },
  { title: "Programare Săptămânală", url: "/weekly-schedules", icon: CalendarDays },
  { title: "Alerte Securitate", url: "/alerts", icon: AlertTriangle },
  { title: "Locații Lucru", url: "/work-locations", icon: MapPin },
  { title: "Import Salariați", url: "/bulk-import", icon: Users },
  { title: "Concedii", url: "/vacations", icon: Calendar },
  { title: "Setări GDPR", url: "/gdpr-settings", icon: Shield },
];

// Meniuri pentru Angajați
const employeeMenuItems = [
  { title: "Pontaj", url: "/mobile", icon: Clock },
  { title: "Pontajele Mele", url: "/my-time-entries", icon: FileText },
  { title: "Concedii", url: "/vacations", icon: Calendar },
  { title: "Setări GDPR", url: "/gdpr-settings", icon: Shield },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { userRole } = useAuth();
  const [menuItems, setMenuItems] = useState<typeof adminMenuItems>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const APP_VERSION = "0610.2025.00001";

  useEffect(() => {
    // Setează meniurile bazate pe rol
    if (userRole === 'admin') {
      setMenuItems(adminMenuItems);
    } else {
      setMenuItems(employeeMenuItems);
    }
  }, [userRole]);

  const handleForceUpdate = async () => {
    setIsRefreshing(true);
    
    toast({
      title: "🔄 Actualizare în curs...",
      description: "Aplicația se va reîncărca în curând.",
      duration: 2000,
    });

    // Așteaptă puțin pentru ca userul să vadă toast-ul
    setTimeout(async () => {
      try {
        await forceRefreshApp();
      } catch (error) {
        console.error("Force refresh failed:", error);
        // Fallback la reload simplu
        window.location.reload();
      }
    }, 1500);
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarContent className="gap-0">
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-6">
          {open ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Clock className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">TimeTrack</span>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "!text-white hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleForceUpdate}
            disabled={isRefreshing}
            variant="outline"
            size={open ? "default" : "icon"}
            className="w-full glass-button touch-target-lg hover:glow-primary"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''} ${open ? 'mr-2' : ''}`} />
            {open && <span>Actualizare</span>}
          </Button>
          
          {open && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Versiune: <span className="font-mono font-semibold text-primary">{APP_VERSION}</span>
              </p>
              {isIOSPWA() && (
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  iOS PWA Mode
                </p>
              )}
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
