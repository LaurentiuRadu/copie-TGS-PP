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
    return <Navigate to="/auth" replace />;
  }

  if (userRole === "admin") return <Navigate to="/admin" replace />;
  if (userRole === "employee") return <Navigate to="/mobile" replace />;

  // Default fallback: go to admin (ProtectedRoute will reroute employees to /mobile)
  return <Navigate to="/admin" replace />;
};

export default RootRedirect;
