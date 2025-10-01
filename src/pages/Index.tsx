import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActiveTimer } from "@/components/ActiveTimer";
import heroImage from "@/assets/hero-team.jpg";

const Index = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Bine ai venit, <span className="font-medium text-foreground">Alex Popescu</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {/* Hero Section */}
            <div className="relative h-48 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-primary opacity-90" />
              <img 
                src={heroImage} 
                alt="Team collaboration" 
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
              />
              <div className="relative h-full flex items-center px-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Time Tracking & Productivity
                  </h2>
                  <p className="text-white/90 max-w-2xl">
                    Monitorizează timpul lucrat, gestionează proiecte și crește productivitatea echipei tale.
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <ActiveTimer />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
