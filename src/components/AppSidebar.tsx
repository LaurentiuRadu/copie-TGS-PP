import { Home, Clock, BarChart3, Calendar, Users, Settings, MapPin, ClipboardList, FileText, AlertTriangle, Shield, UserCog, CalendarDays, Table, RefreshCw, HardDrive, LogOut, ClipboardCheck, History, ChevronRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { forceRefreshApp, isIOSPWA } from "@/lib/iosPwaUpdate";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveTimeEntry } from "@/hooks/useActiveTimeEntry";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import tgsLogo from "@/assets/tgs-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Meniuri pentru Admin
const adminMenuItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Monitorizare Pontaje Live", url: "/time-entries", icon: ClipboardList },
  { 
    title: "Timesheet & Verificare", 
    icon: Table,
    badge: true,
    isParent: true,
    children: [
      { title: "Fișe Pontaj", url: "/timesheet", icon: FileText },
      { title: "Verificare Pontaje", url: "/timesheet/verificare", icon: ClipboardCheck, badge: true },
      { title: "Istoric Aprobări", url: "/timesheet/istoric", icon: History },
    ]
  },
  { title: "Programare Săptămânală", url: "/weekly-schedules", icon: CalendarDays },
  { title: "Alerte Securitate", url: "/alerts", icon: AlertTriangle },
  { title: "Locații Lucru", url: "/work-locations", icon: MapPin },
  { title: "Concedii", url: "/vacations", icon: Calendar },
  { title: "Setări", url: "/backup-restore", icon: Settings },
  { title: "GDPR", url: "/gdpr-admin", icon: Shield },
];

// Meniuri pentru Angajați
const employeeMenuItems = [
  { title: "Pontaj", url: "/mobile", icon: Clock },
  { title: "Concedii", url: "/vacations", icon: Calendar },
  { title: "GDPR", url: "/gdpr-settings", icon: Shield },
];

export function AppSidebar() {
  const { open, setOpenMobile, isMobile } = useSidebar();
  const { user, signOut } = useAuth();
  const { isAdmin, isEmployee } = useUserRole();
  const [menuItems, setMenuItems] = useState<typeof adminMenuItems>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
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

  // Query pentru pontaje pending (badge pentru Timesheet & Verificare)
  const { data: pendingApprovalsCount } = useQuery({
    queryKey: ['pending-approvals-count-sidebar'],
    queryFn: async () => {
      const { count } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending_review');
      
      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 30000, // 30s
  });

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
                <img src={tgsLogo} alt="TGS PP Logo" className="h-full w-full object-cover" />
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">TGS PP</span>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={tgsLogo} alt="TGS PP Logo" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Meniu Admin */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrare</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => {
                  if (item.isParent && item.children) {
                    // SUBMENIU COLLAPSIBLE
                    const totalBadge = item.badge && pendingApprovalsCount && pendingApprovalsCount > 0 ? pendingApprovalsCount : 0;
                    
                    return (
                      <Collapsible key={item.title} asChild className="group/collapsible">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              {totalBadge > 0 && open && (
                                <Badge variant="destructive" className="ml-auto">
                                  {totalBadge}
                                </Badge>
                              )}
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="space-y-1 py-2">
                              {item.children.map((child) => {
                                const childBadge = child.badge && pendingApprovalsCount && pendingApprovalsCount > 0;
                                
                                return (
                                  <SidebarMenuSubItem key={child.title}>
                                    <SidebarMenuSubButton asChild className="pl-8 h-10">
                                      <NavLink
                                        to={child.url}
                                        onClick={handleNavClick}
                                        end
                                        className={({ isActive }) =>
                                          cn(
                                            "transition-all duration-200",
                                            isActive
                                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                                          )
                                        }
                                      >
                                        <child.icon className="h-3.5 w-3.5" />
                                        <span>{child.title}</span>
                                        {childBadge && (
                                          <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0.5 min-w-[24px]">
                                            {pendingApprovalsCount}
                                          </Badge>
                                        )}
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }
                  
                  // ITEM NORMAL (fără submeniu)
                  const showBadge = item.badge && pendingApprovalsCount && pendingApprovalsCount > 0;
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          onClick={handleNavClick}
                          end
                          className={({ isActive }) =>
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "!text-white hover:bg-sidebar-accent/50"
                          }
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          {showBadge && open && (
                            <Badge variant="destructive" className="ml-auto">
                              {pendingApprovalsCount}
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
                        onClick={handleNavClick}
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
            variant="secondary"
            size={open ? "default" : "icon"}
            className="w-full glass-button touch-target-lg hover:glow-primary"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''} ${open ? 'mr-2' : ''}`} />
            {open && <span>Actualizare</span>}
          </Button>
          
          <Button
            onClick={signOut}
            variant="secondary"
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