import { Home, Clock, BarChart3, Calendar, Users, Settings, MapPin, ClipboardList, FileText, AlertTriangle, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Panou Principal", url: "/admin", icon: Home },
  { title: "Pontaj Mobil", url: "/mobile", icon: Clock },
  { title: "Pontaje Admin", url: "/time-entries", icon: ClipboardList },
  { title: "Pontajele Mele", url: "/my-time-entries", icon: FileText },
  { title: "Alerte Securitate", url: "/alerts", icon: AlertTriangle },
  { title: "Verificări Faciale", url: "/face-verifications", icon: Shield },
  { title: "Locații Lucru", url: "/work-locations", icon: MapPin },
  { title: "Concedii", url: "/vacations", icon: Calendar },
  { title: "Setări", url: "/setari", icon: Settings },
];

export function AppSidebar() {
  const { open } = useSidebar();

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
          <SidebarGroupLabel>Navigare</SidebarGroupLabel>
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
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
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
    </Sidebar>
  );
}
