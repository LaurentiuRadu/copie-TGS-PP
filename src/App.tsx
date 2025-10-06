import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
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
import MyTimeEntries from "./pages/MyTimeEntries";
import Alerts from "./pages/Alerts";
import FaceVerifications from "./pages/FaceVerifications";
import BulkImport from "./pages/BulkImport";
import UserManagement from "./pages/UserManagement";
import WeeklySchedules from "./pages/WeeklySchedules";
import GDPRAdmin from "./pages/GDPRAdmin";
import Timesheet from "./pages/Timesheet";
import GDPRSettings from "./pages/GDPRSettings";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <PWAInstallPrompt />
    <AuthProvider>
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
                path="/my-time-entries"
                element={
                  <ProtectedRoute allowedRole="employee">
                    <MyTimeEntries />
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
                path="/bulk-import"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <BulkImport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user-management"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <UserManagement />
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
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  </TooltipProvider>
);

export default App;
