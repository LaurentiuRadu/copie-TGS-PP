import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { z } from "zod";

const employeeSchema = z.object({
  username: z.string().trim().min(3, "Username-ul trebuie să aibă minim 3 caractere").max(50),
  password: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),
});

const adminSchema = z.object({
  email: z.string().trim().email("Email invalid"),
  password: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  // Employee form
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeFullName, setEmployeeFullName] = useState("");

  // Password visibility
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

  const handleEmployeeAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const validated = employeeSchema.parse({
        username: employeeUsername,
        password: employeePassword,
      });

      if (isSignUp) {
        // Signup disabled for employees - only admins can create employee accounts
        throw new Error("Crearea contului de angajat este dezactivată. Contactează administratorul pentru a-ți crea un cont.");
      } else {
        const primaryEmail = `${validated.username}@company.local`;

        let { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: primaryEmail,
          password: validated.password,
        });

        if (signInError && signInError.message.includes("Invalid")) {
          const fallbackEmail = `${validated.username}@employee.local`;

          const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({
            email: fallbackEmail,
            password: validated.password,
          });

          if (fallbackError) {
            throw new Error("Username sau parolă incorectă");
          }

          if (fallbackData.user) {
            supabase.auth.admin.updateUserById(fallbackData.user.id, {
              email: primaryEmail
            }).catch(err => console.error("Domain migration error:", err));

            toast.success("Autentificare reușită!");
            data = fallbackData;
          }
        } else if (signInError) {
          throw signInError;
        }

        if (!data?.session) {
          throw new Error("Autentificare eșuată - sesiune invalidă");
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.session.user.id)
          .maybeSingle();

        if (!roleData || roleData.role !== 'employee') {
          await supabase.auth.signOut();
          throw new Error("Acces interzis - doar pentru angajați");
        }

        navigate("/mobile");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("A apărut o eroare");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-start justify-center p-4 pt-8">
      <Card className="w-full max-w-md shadow-elegant border-primary/20">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            TGS PP
          </CardTitle>
          <CardDescription className="text-base">
            {isSignUp ? "Creează cont nou" : "Autentificare Angajat"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleEmployeeAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee-username">Username</Label>
                  <Input
                    id="employee-username"
                    placeholder="ex: numeprenume"
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value.toLowerCase())}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: nume + prenume (fără spații)
                  </p>
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="employee-fullname">Nume Complet</Label>
                    <Input
                      id="employee-fullname"
                      placeholder="ex: Ion Popescu"
                      value={employeeFullName}
                      onChange={(e) => setEmployeeFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="employee-password">Parolă</Label>
                  <div className="relative">
                    <Input
                      id="employee-password"
                      type={showEmployeePassword ? "text" : "password"}
                      placeholder="••••••"
                      value={employeePassword}
                      onChange={(e) => setEmployeePassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                      disabled={loading}
                    >
                      {showEmployeePassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 transition-all shadow-md" disabled={loading}>
              {loading ? "Se procesează..." : isSignUp ? "Creează cont angajat" : "Autentificare angajat"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              to="/admin-login" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Ești administrator? Click aici
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
