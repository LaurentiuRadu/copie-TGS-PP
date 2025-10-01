import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Clock, Calendar, MapPin, AlertTriangle, Camera, FileSpreadsheet, LogOut, LayoutDashboard } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const adminRoutes = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    description: "Vizualizare generală și statistici",
  },
  {
    title: "Gestionare Utilizatori",
    url: "/user-management",
    icon: Users,
    description: "Administrare conturi și parole",
  },
  {
    title: "Pontaje Detaliate",
    url: "/time-entries",
    icon: Clock,
    description: "Vizualizare pontaje cu GPS și fotografii",
  },
  {
    title: "Concedii",
    url: "/vacations",
    icon: Calendar,
    description: "Aprobare cereri de concediu",
  },
  {
    title: "Locații de Lucru",
    url: "/work-locations",
    icon: MapPin,
    description: "Gestionare zone GPS autorizate",
  },
  {
    title: "Alerte de Securitate",
    url: "/alerts",
    icon: AlertTriangle,
    description: "Monitorizare și rezolvare alerte",
  },
  {
    title: "Verificări Faciale",
    url: "/face-verifications",
    icon: Camera,
    description: "Istoricul verificărilor biometrice",
  },
  {
    title: "Import Masiv",
    url: "/bulk-import",
    icon: FileSpreadsheet,
    description: "Creeare utilizatori din Excel",
  },
];

export function AdminSearchCommand() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-10 w-full max-w-md justify-start text-sm text-muted-foreground hover:bg-accent/50 transition-all duration-200"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="inline-flex flex-1">Caută...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Caută pagini, funcții..." />
        <CommandList>
          <CommandEmpty>Nu s-au găsit rezultate.</CommandEmpty>
          
          <CommandGroup heading="Navigare">
            {adminRoutes.map((route) => (
              <CommandItem
                key={route.url}
                onSelect={() => handleSelect(() => navigate(route.url))}
                className="flex items-start gap-3 p-3 cursor-pointer"
              >
                <route.icon className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1 space-y-1">
                  <div className="font-medium">{route.title}</div>
                  <div className="text-xs text-muted-foreground">{route.description}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Acțiuni">
            <CommandItem
              onSelect={() => handleSelect(() => signOut())}
              className="flex items-center gap-3 p-3 cursor-pointer text-destructive"
            >
              <LogOut className="h-5 w-5" />
              <div className="font-medium">Deconectare</div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
