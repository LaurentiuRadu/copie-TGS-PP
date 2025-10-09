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
import GDPRSettings from "./pages/GDPRSettings";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import { GDPRConsentAlert } from "./components/GDPRConsentAlert";
import { UpdateNotification } from "./components/UpdateNotification";

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
              <Route
                path="/mobile"
                element={
                  <ProtectedRoute allowedRole="employee">
                    <Mobile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/landing" element={<Landing />} />
              <Route
                path="/vacations"
                element={
                  <ProtectedRoute>
                    <Vacations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/work-locations"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <WorkLocations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/time-entries"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <TimeEntries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <Alerts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/face-verifications"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <FaceVerifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/weekly-schedules"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <WeeklySchedules />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-team-schedule"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <EditTeamSchedule />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/timesheet"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <Timesheet />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gdpr-admin"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <GDPRAdmin />
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
              <Route
                path="/backup-restore"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <Settings />
                  </ProtectedRoute>
                }
          />
          
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
