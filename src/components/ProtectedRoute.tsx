import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'admin' | 'employee';
}

/**
 * ProtectedRoute - Protejează rutele bazat pe rol
 * 
 * IMPORTANT: Admin-ii au acces la TOATE rutele (admin + employee)
 * Angajații normali au acces doar la rutele employee
 */
export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isEmployee, loading: roleLoading } = useUserRole();

  const loading = authLoading || roleLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Utilizator neautentificat → redirect la login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Dacă nu e specificat un rol specific, permite accesul
  if (!allowedRole) {
    return <>{children}</>;
  }

  // Admin-ii au acces la ORICE (inclusiv rute employee și admin)
  if (isAdmin) {
    return <>{children}</>;
  }

  // Verifică dacă user-ul are rolul necesar
  if (allowedRole === 'employee' && isEmployee) {
    return <>{children}</>;
  }

  if (allowedRole === 'admin' && !isAdmin) {
    // User fără rol admin încearcă să acceseze rută admin → redirect la mobile
    return <Navigate to="/mobile" replace />;
  }

  // Fallback: redirect bazat pe rol
  if (isEmployee) {
    return <Navigate to="/mobile" replace />;
  }

  return <Navigate to="/auth" replace />;
}
