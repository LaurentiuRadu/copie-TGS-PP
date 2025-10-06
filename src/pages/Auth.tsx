import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertCircle, Eye, EyeOff } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"employee" | "admin">("employee");

  // Employee form
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeFullName, setEmployeeFullName] = useState("");

  // Admin form
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Password visibility
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

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
        // For signup, we create an account with username as email (workaround)
        const email = `${validated.username}@company.local`;
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: validated.password,
          options: {
            data: {
              username: validated.username,
              full_name: employeeFullName,
            },
            emailRedirectTo: `${window.location.origin}/mobile`,
          },
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          // Assign employee role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: signUpData.user.id,
              role: 'employee',
            });

          if (roleError) throw roleError;

          toast.success("Contul de angajat a fost creat cu succes!");
          navigate("/mobile");
        }
      } else {
        // Login with username - try both domains with fallback
        const primaryEmail = `${validated.username}@company.local`;
        
        let { error: signInError } = await supabase.auth.signInWithPassword({
          email: primaryEmail,
          password: validated.password,
        });

        // If failed with @company.local, try @employee.local
        if (signInError && signInError.message.includes("Invalid")) {
          const fallbackEmail = `${validated.username}@employee.local`;
          
          const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({
            email: fallbackEmail,
            password: validated.password,
          });

          if (fallbackError) {
            throw new Error("Username sau parolă incorectă");
          }

          // Successfully logged in with old domain - migrate to new domain in background
          if (fallbackData.user) {
            supabase.auth.admin.updateUserById(fallbackData.user.id, {
              email: primaryEmail
            }).catch(err => console.error("Domain migration error:", err));
            
            toast.success("Autentificare reușită!");
          }
        } else if (signInError) {
          throw signInError;
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

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const validated = adminSchema.parse({
        email: adminEmail,
        password: adminPassword,
      });

      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            emailRedirectTo: `${window.location.origin}/admin`,
          },
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          // Assign admin role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: signUpData.user.id,
              role: 'admin',
            });

          if (roleError) throw roleError;

          toast.success("Contul de administrator a fost creat cu succes!");
          navigate("/admin");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password: validated.password,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid")) {
            throw new Error("Email sau parolă incorectă");
          }
          throw signInError;
        }

        navigate("/admin");
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
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg">
              <Clock className="h-10 w-10 text-primary-foreground animate-pulse-soft" />
            </div>
          </div>
          <CardTitle className={`text-3xl font-bold ${activeTab === "admin" ? "bg-gradient-secondary" : "bg-gradient-primary"} bg-clip-text text-transparent`}>
            TimeTrack
          </CardTitle>
          <CardDescription className="text-base">
            {isSignUp ? "Creează cont nou" : "Autentificare în sistem"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="employee" className="w-full" onValueChange={(value) => setActiveTab(value as "employee" | "admin")}>
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
              <TabsTrigger 
                value="employee" 
                className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground transition-all"
              >
                Angajat
              </TabsTrigger>
              <TabsTrigger 
                value="admin"
                className="data-[state=active]:bg-gradient-secondary data-[state=active]:text-secondary-foreground transition-all"
              >
                Administrator
              </TabsTrigger>
            </TabsList>

            <TabsContent value="employee" className="space-y-1">
              <form onSubmit={handleEmployeeAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee-username">Username</Label>
                  <Input
                    id="employee-username"
                    placeholder="ex: ionpopescu"
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
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
            </TabsContent>

            <TabsContent value="admin" className="space-y-1">
              <form onSubmit={handleAdminAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
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
                  <Label htmlFor="admin-password">Parolă</Label>
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

                <Button type="submit" className="w-full bg-gradient-secondary hover:opacity-90 transition-all shadow-md" disabled={loading}>
                  {loading ? "Se procesează..." : isSignUp ? "Creează cont admin" : "Autentificare admin"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className={`text-sm ${activeTab === "admin" ? "text-secondary hover:text-secondary/80" : "text-primary hover:text-primary/80"} transition-colors`}
            >
              {isSignUp ? "Am deja cont" : "Creează cont nou"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
