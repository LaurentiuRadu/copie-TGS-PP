import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertCircle, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { z } from "zod";
import { 
  checkPasswordStrength, 
  getPasswordStrengthColor, 
  getPasswordStrengthLabel,
  type PasswordStrength 
} from "@/lib/passwordValidation";
import { checkRateLimit, formatResetTime } from "@/lib/rateLimiting";

const employeeSchema = z.object({
  username: z.string().trim().min(3, "Username-ul trebuie să aibă minim 3 caractere").max(50),
  password: z.string().min(12, "Parola trebuie să aibă minim 12 caractere"),
});

const adminSchema = z.object({
  email: z.string().trim().email("Email invalid"),
  password: z.string().min(12, "Parola trebuie să aibă minim 12 caractere"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showAdminTab, setShowAdminTab] = useState(false);

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

  // Password strength
  const [employeePasswordStrength, setEmployeePasswordStrength] = useState<PasswordStrength | null>(null);
  const [adminPasswordStrength, setAdminPasswordStrength] = useState<PasswordStrength | null>(null);
  const [checkingPassword, setCheckingPassword] = useState(false);

  // Rate limiting
  const [rateLimited, setRateLimited] = useState(false);
  const [resetTime, setResetTime] = useState<string | null>(null);

  // Check password strength when password changes (debounced)
  useEffect(() => {
    if (!isSignUp) return;

    const checkEmployeePassword = async () => {
      if (employeePassword.length < 12) {
        setEmployeePasswordStrength(null);
        return;
      }

      setCheckingPassword(true);
      const strength = await checkPasswordStrength(employeePassword);
      setEmployeePasswordStrength(strength);
      setCheckingPassword(false);
    };

    const timer = setTimeout(checkEmployeePassword, 500);
    return () => clearTimeout(timer);
  }, [employeePassword, isSignUp]);

  useEffect(() => {
    if (!isSignUp) return;

    const checkAdminPassword = async () => {
      if (adminPassword.length < 12) {
        setAdminPasswordStrength(null);
        return;
      }

      setCheckingPassword(true);
      const strength = await checkPasswordStrength(adminPassword);
      setAdminPasswordStrength(strength);
      setCheckingPassword(false);
    };

    const timer = setTimeout(checkAdminPassword, 500);
    return () => clearTimeout(timer);
  }, [adminPassword, isSignUp]);

  const handleEmployeeAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setRateLimited(false);

    try {
      // Check rate limit before attempting auth
      const ipAddress = "employee-" + employeeUsername; // Use username as identifier
      const rateLimit = await checkRateLimit(ipAddress, 'login');
      
      if (!rateLimit.allowed) {
        setRateLimited(true);
        setResetTime(rateLimit.reset_at);
        const timeMsg = formatResetTime(rateLimit.reset_at);
        throw new Error(`Prea multe încercări de autentificare. Încearcă din nou ${timeMsg}.`);
      }

      const validated = employeeSchema.parse({
        username: employeeUsername,
        password: employeePassword,
      });

      // For signup, validate password strength
      if (isSignUp) {
        const strength = await checkPasswordStrength(validated.password);
        if (!strength.isStrong) {
          throw new Error("Parola nu îndeplinește cerințele de securitate: " + strength.feedback.join(", "));
        }

        if (strength.isCompromised) {
          throw new Error("Această parolă a fost compromisă în breșe de securitate. Alege o altă parolă.");
        }

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
          navigate("/mobile", { replace: true });
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

        navigate("/mobile", { replace: true });
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
    setRateLimited(false);

    try {
      // Check rate limit before attempting auth
      const ipAddress = "admin-" + adminEmail;
      const rateLimit = await checkRateLimit(ipAddress, 'login');
      
      if (!rateLimit.allowed) {
        setRateLimited(true);
        setResetTime(rateLimit.reset_at);
        const timeMsg = formatResetTime(rateLimit.reset_at);
        throw new Error(`Prea multe încercări de autentificare. Încearcă din nou ${timeMsg}.`);
      }

      const validated = adminSchema.parse({
        email: adminEmail,
        password: adminPassword,
      });

      if (isSignUp) {
        // Validate password strength for signup
        const strength = await checkPasswordStrength(validated.password);
        if (!strength.isStrong) {
          throw new Error("Parola nu îndeplinește cerințele de securitate: " + strength.feedback.join(", "));
        }

        if (strength.isCompromised) {
          throw new Error("Această parolă a fost compromisă în breșe de securitate. Alege o altă parolă.");
        }

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
          navigate("/admin", { replace: true });
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

        navigate("/admin", { replace: true });
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
          <h1 className="text-2xl font-semibold">TimeTrack</h1>
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

          <Tabs value={showAdminTab ? "admin" : "employee"} onValueChange={(val) => setShowAdminTab(val === "admin")} className="w-full">
            {showAdminTab ? (
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger 
                  value="employee" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Angajat
                </TabsTrigger>
                <TabsTrigger 
                  value="admin"
                  className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                >
                  Administrator
                </TabsTrigger>
              </TabsList>
            ) : (
              <div className="mb-6 text-center">
                <Button
                  variant="link"
                  onClick={() => setShowAdminTab(true)}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Login Administrator →
                </Button>
              </div>
            )}

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

                {/* Password Strength Indicator for Signup */}
                {isSignUp && employeePassword.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    {checkingPassword ? (
                      <p className="text-sm text-muted-foreground">Se verifică parola...</p>
                    ) : employeePasswordStrength ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Putere parolă:</span>
                          <span className={`text-sm font-medium ${getPasswordStrengthColor(employeePasswordStrength.score)}`}>
                            {getPasswordStrengthLabel(employeePasswordStrength.score)}
                          </span>
                        </div>
                        <Progress value={employeePasswordStrength.score} className="h-2" />
                        {employeePasswordStrength.feedback.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {employeePasswordStrength.feedback.map((msg, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>{msg}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {employeePasswordStrength.isCompromised && (
                          <Alert variant="destructive" className="mt-2">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Această parolă a fost compromisă în breșe de securitate!
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Parola trebuie să aibă min. 12 caractere, majuscule, minuscule, cifre și simboluri.
                      </p>
                    )}
                  </div>
                )}

                {/* Rate Limit Warning */}
                {rateLimited && (
                  <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      Prea multe încercări. Încearcă din nou {formatResetTime(resetTime)}.
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || (isSignUp && (!employeePasswordStrength?.isStrong || checkingPassword))}
                >
                  {loading ? "Se procesează..." : isSignUp ? "Creează cont angajat" : "Autentificare angajat"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="border-l-4 border-accent pl-4">
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

                {/* Password Strength Indicator for Signup */}
                {isSignUp && adminPassword.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    {checkingPassword ? (
                      <p className="text-sm text-muted-foreground">Se verifică parola...</p>
                    ) : adminPasswordStrength ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Putere parolă:</span>
                          <span className={`text-sm font-medium ${getPasswordStrengthColor(adminPasswordStrength.score)}`}>
                            {getPasswordStrengthLabel(adminPasswordStrength.score)}
                          </span>
                        </div>
                        <Progress value={adminPasswordStrength.score} className="h-2" />
                        {adminPasswordStrength.feedback.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {adminPasswordStrength.feedback.map((msg, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>{msg}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {adminPasswordStrength.isCompromised && (
                          <Alert variant="destructive" className="mt-2">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Această parolă a fost compromisă în breșe de securitate!
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Parola trebuie să aibă min. 12 caractere, majuscule, minuscule, cifre și simboluri.
                      </p>
                    )}
                  </div>
                )}

                {/* Rate Limit Warning */}
                {rateLimited && (
                  <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      Prea multe încercări. Încearcă din nou {formatResetTime(resetTime)}.
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" 
                  disabled={loading || (isSignUp && (!adminPasswordStrength?.isStrong || checkingPassword))}
                >
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
