import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const RootRedirect = () => {
  const { loading, user, userRole } = useAuth();

  console.debug('[RootRedirect]', { loading, hasUser: !!user, userRole });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Default to employee login, admin users should use /admin-login
    return <Navigate to="/auth" replace />;
  }

  if (userRole === "admin") return <Navigate to="/dashboard" replace />;
  if (userRole === "employee") return <Navigate to="/mobile" replace />;

  // Default fallback to auth if no role
  return <Navigate to="/auth" replace />;
};

export default RootRedirect;
