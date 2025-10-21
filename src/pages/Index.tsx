import { useAuth } from "@/contexts/AuthContext";
import heroImage from "@/assets/hero-team.jpg";
import { SecurityAlertsManager } from "@/components/SecurityAlertsManager";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { WeeklyHoursChart } from "@/components/dashboard/WeeklyHoursChart";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { QuickActions } from "@/components/dashboard/QuickActions";

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <div className="relative h-32 md:h-48 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-90" />
        <img 
          src={heroImage} 
          alt="Team collaboration" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
        />
        <div className="relative h-full flex items-center px-4 md:px-6">
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">
              Time Tracking & Productivity
            </h2>
            <p className="text-white/90 text-sm md:text-base max-w-2xl">
              Monitorizează timpul lucrat, gestionează proiecte și crește productivitatea.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Stats Cards */}
        <DashboardStats />

        {/* Charts & Activity Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <WeeklyHoursChart />
          <RecentActivityFeed />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Security Alerts */}
        <SecurityAlertsManager />
      </div>
    </div>
  );
};

export default Index;
