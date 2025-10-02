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
  password: z.string().min(4, "Parola trebuie să aibă minim 4 caractere"),
});

const adminSchema = z.object({
  email: z.string().trim().email("Email invalid"),
  password: z.string().min(4, "Parola trebuie să aibă minim 4 caractere"),
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
        // Login with username
        const email = `${validated.username}@company.local`;
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: validated.password,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid")) {
            throw new Error("Username sau parolă incorectă");
          }
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
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">TimeTrack</CardTitle>
          <CardDescription>
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

          <Tabs defaultValue="employee" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger 
                value="employee" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Angajat
              </TabsTrigger>
              <TabsTrigger 
                value="admin"
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                Administrator
              </TabsTrigger>
            </TabsList>

            <TabsContent value="employee" className="border-l-4 border-primary pl-4">
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Se procesează..." : isSignUp ? "Creează cont angajat" : "Autentificare angajat"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="border-l-4 border-secondary pl-4">
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Se procesează..." : isSignUp ? "Creează cont admin" : "Autentificare admin"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm"
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
