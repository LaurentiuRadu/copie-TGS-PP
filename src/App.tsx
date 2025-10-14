import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { useAutoDarkMode } from "./hooks/useAutoDarkMode";
import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Mobile from "./pages/Mobile";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import NotFound from "./pages/NotFound";
import Vacations from "./pages/Vacations";
import WorkLocations from "./pages/WorkLocations";
import RootRedirect from "./pages/RootRedirect";
import TimeEntries from "./pages/TimeEntries";
import Alerts from "./pages/Alerts";
import FaceVerifications from "./pages/FaceVerifications";

import WeeklySchedules from "./pages/WeeklySchedules";
import EditTeamSchedule from "./pages/EditTeamSchedule";
import GDPRAdmin from "./pages/GDPRAdmin";
import Timesheet from "./pages/Timesheet";
import TimesheetVerificare from "./pages/TimesheetVerificare";
import TimesheetIstoric from "./pages/TimesheetIstoric";
import TimesheetTardiness from "./pages/TimesheetTardiness";
import GDPRSettings from "./pages/GDPRSettings";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import { GDPRConsentAlert } from "./components/GDPRConsentAlert";
import { UpdateNotification } from "./components/UpdateNotification";
import { AdminLayout } from "./components/AdminLayout";
import { Outlet } from "react-router-dom";

const App = () => {
  const [themeMode, setThemeMode] = useState<string>(() => {
    return localStorage.getItem("theme-preference") || "system";
  });

  // Ascultă schimbări în localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newMode = localStorage.getItem("theme-preference") || "system";
      setThemeMode(newMode);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Activează auto-theme dacă este setat pe "auto"
  const autoModeEnabled = themeMode === "auto";
  useAutoDarkMode(autoModeEnabled);

  // Fallback: ensure the correct theme class is applied when in auto mode
  useEffect(() => {
    if (!autoModeEnabled) return;

    const ensureThemeClass = () => {
      const html = document.documentElement;
      const storedTheme = localStorage.getItem("app-theme"); // next-themes storageKey
      const hasDark = html.classList.contains("dark");

      if (storedTheme === "dark" && !hasDark) {
        html.classList.add("dark");
        html.classList.remove("light");
        console.warn("Forced dark class on <html> (auto mode)");
      } else if (storedTheme === "light" && hasDark) {
        html.classList.remove("dark");
        html.classList.add("light");
        console.warn("Forced light class on <html> (auto mode)");
      }
      console.info(`[Theme] auto ensure → app-theme=${storedTheme}, html=${html.className}`);
    };

    // run immediately and on interval
    ensureThemeClass();
    const id = setInterval(ensureThemeClass, 60 * 1000);
    const t = setTimeout(ensureThemeClass, 200);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [autoModeEnabled]);
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallPrompt />
      <AuthProvider>
        <GDPRConsentAlert />
        <UpdateNotification />
        <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin-login" element={<AdminAuth />} />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/landing" element={<Landing />} />
              
              {/* Employee Routes */}
              <Route
                path="/mobile"
                element={
                  <ProtectedRoute allowedRole="employee">
                    <Mobile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vacations"
                element={
                  <ProtectedRoute>
                    <Vacations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gdpr-settings"
                element={
                  <ProtectedRoute allowedRole="employee">
                    <GDPRSettings />
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes with Shared Layout */}
              <Route
                element={
                  <ProtectedRoute allowedRole="admin">
                    <AdminLayout>
                      <Outlet />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              >
                <Route path="/admin" element={<Admin />} />
                <Route path="/time-entries" element={<TimeEntries />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/work-locations" element={<WorkLocations />} />
                <Route path="/face-verifications" element={<FaceVerifications />} />
                <Route path="/weekly-schedules" element={<WeeklySchedules />} />
                <Route path="/edit-team-schedule" element={<EditTeamSchedule />} />
                <Route path="/timesheet" element={<Timesheet />} />
                <Route path="/timesheet/verificare" element={<TimesheetVerificare />} />
                <Route path="/timesheet/istoric" element={<TimesheetIstoric />} />
                <Route path="/timesheet/rapoarte-intarzieri" element={<TimesheetTardiness />} />
                <Route path="/gdpr-admin" element={<GDPRAdmin />} />
                <Route path="/backup-restore" element={<Settings />} />
              </Route>
          
          {/* Protected GDPR Pages */}
          <Route
            path="/privacy-policy"
            element={
              <ProtectedRoute>
                <PrivacyPolicy />
              </ProtectedRoute>
            }
          />
          <Route
            path="/terms"
            element={
              <ProtectedRoute>
                <TermsAndConditions />
              </ProtectedRoute>
            }
          />
          
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  );
};

export default App;
