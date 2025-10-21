import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Eye, EyeOff, WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { Link } from "react-router-dom";

const adminSchema = z.object({
  email: z.string().trim().email("Email invalid"),
  password: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),
});

const AdminAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Redirect dacă există deja sesiune activă
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Verifică conexiunea înainte de a încerca
    if (!navigator.onLine) {
      setError("Sunteți offline – verificați conexiunea la internet");
      return;
    }

    setLoading(true);

    // Safety timeout pentru sign-in (15s)
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      setError("Timeout – vă rugăm verificați conexiunea și reîncercați");
    }, 15000);

    try {
      const validated = adminSchema.parse({
        email: adminEmail,
        password: adminPassword,
      });

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      clearTimeout(loadingTimeout);

      if (signInError) {
        // Mapare erori prietenoase
        if (signInError.message.includes("Invalid login")) {
          throw new Error("Email sau parolă incorectă");
        }
        if (signInError.message.includes("Email not confirmed")) {
          throw new Error("Email neconfirmat – verificați inbox-ul");
        }
        if (signInError.message.includes("Network") || signInError.message.includes("fetch")) {
          throw new Error("Problemă de rețea – verificați conexiunea");
        }
        throw new Error("Eroare la autentificare – încercați din nou");
      }

      if (!data.session) {
        throw new Error("Autentificare eșuată – sesiune invalidă");
      }

      // Succes - ProtectedRoute va verifica rolul
      setLoading(false);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      clearTimeout(loadingTimeout);
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("A apărut o eroare neașteptată");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-start justify-center p-4 pt-8">
      <Card className="w-full max-w-md shadow-elegant bg-secondary border-secondary">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-3xl font-bold text-white">
            TGS PP
          </CardTitle>
          <CardDescription className="text-base">
            Autentificare Administrator
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAdminAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-white">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="ex: admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-white">Parolă</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showAdminPassword ? "text" : "password"}
                  placeholder="••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  disabled={loading}
                >
                  {showAdminPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-secondary hover:opacity-90 transition-all shadow-md" 
              disabled={loading}
            >
              {loading ? "Se procesează..." : "Autentificare admin"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              to="/auth" 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Ești angajat? Click aici
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;
