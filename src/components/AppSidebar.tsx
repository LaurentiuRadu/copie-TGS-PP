import { Home, Clock, BarChart3, Calendar, Users, Settings, MapPin, ClipboardList, FileText, AlertTriangle, Shield, UserCog, CalendarDays, Table, RefreshCw, HardDrive, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { forceRefreshApp, isIOSPWA } from "@/lib/iosPwaUpdate";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveTimeEntry } from "@/hooks/useActiveTimeEntry";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  { title: "Setări", url: "/backup-restore", icon: Settings },
  { title: "GDPR", url: "/gdpr-admin", icon: Shield },
];

// Meniuri pentru Angajați
const employeeMenuItems = [
  { title: "Pontaj", url: "/mobile", icon: Clock },
  { title: "Pontajele Mele", url: "/my-time-entries", icon: FileText },
  { title: "Concedii", url: "/vacations", icon: Calendar },
  { title: "GDPR", url: "/gdpr-settings", icon: Shield },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { user, signOut } = useAuth();
  const { isAdmin, isEmployee } = useUserRole();
  const [menuItems, setMenuItems] = useState<typeof adminMenuItems>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Versiune fixă + build number din baza de date
  const { data: currentVersion } = useQuery({
    queryKey: ['currentAppVersion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_versions')
        .select('version')
        .eq('is_current', true)
        .single();
      
      if (error) {
        console.error('Error fetching version:', error);
        return '10'; // Default fallback
      }
      
      return data?.version || '10';
    },
  });
  
  const APP_VERSION = `06.10.2008.${currentVersion || '10'}`;
  
  // Monitor pontaj activ pentru badge notification
  const { hasActiveEntry } = useActiveTimeEntry(user?.id);

  useEffect(() => {
    // Admin-ii văd TOATE meniurile cu separare clară
    if (isAdmin) {
      setMenuItems([
        ...adminMenuItems,
      ]);
    } else if (isEmployee) {
      // Angajații normali văd doar meniurile employee
      setMenuItems(employeeMenuItems);
    } else {
      setMenuItems([]);
    }
  }, [isAdmin, isEmployee]);

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

        {/* Meniu Admin */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrare</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
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
        )}

        {/* Meniu Personal (pentru toți sau doar employee) */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {isAdmin ? "Pontaj Personal" : "Meniu Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeMenuItems.map((item) => {
                const isPontajMenu = item.url === '/mobile';
                const showBadge = isPontajMenu && hasActiveEntry;
                
                return (
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
                        <div className="relative">
                          <item.icon className="h-4 w-4" />
                          {showBadge && (
                            <Badge 
                              className="absolute -top-1 -right-1 h-2 w-2 p-0 bg-red-500 animate-pulse"
                              variant="destructive"
                            />
                          )}
                        </div>
                        <span>{item.title}</span>
                        {showBadge && open && (
                          <Badge 
                            variant="destructive" 
                            className="ml-auto animate-pulse text-xs"
                          >
                            Activ
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
          
          <Button
            onClick={signOut}
            variant="outline"
            size={open ? "default" : "icon"}
            className="w-full"
          >
            <LogOut className={`h-4 w-4 ${open ? 'mr-2' : ''}`} />
            {open && <span>Deconectare</span>}
          </Button>
          
          {open && (
            <div className="text-center pt-2 border-t border-sidebar-border/50">
              <p className="text-[10px] text-muted-foreground/60">
                v{APP_VERSION}
              </p>
              {isIOSPWA() && (
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                  iOS PWA
                </p>
              )}
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}