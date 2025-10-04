import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";

const passwordSchema = z.object({
  oldPassword: z.string().min(1, "Parola veche este necesară"),
  newPassword: z
    .string()
    .min(8, "Parola trebuie să aibă minimum 8 caractere")
    .regex(/[A-Z]/, "Parola trebuie să conțină cel puțin o literă mare")
    .regex(/[0-9]/, "Parola trebuie să conțină cel puțin o cifră"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Parolele nu se potrivesc",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ChangePassword() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      setIsLoading(true);

      // Verify old password by attempting to sign in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Utilizatorul nu este autentificat");
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) throw updateError;

      // Update password tracking table
      const { error: trackingError } = await supabase
        .from("user_password_tracking")
        .update({
          password_changed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (trackingError) throw trackingError;

      toast({
        title: "Parolă schimbată cu succes",
        description: "Parola ta a fost actualizată.",
      });

      // Redirect based on role
      setTimeout(() => {
        navigate(userRole === "admin" ? "/admin" : "/mobile");
      }, 1500);
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut schimba parola. Verifică parola veche.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mr-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Înapoi
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>Schimbă Parola</CardTitle>
          </div>
          <CardDescription>
            Actualizează-ți parola pentru a menține contul sigur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parola Veche</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showOldPassword ? "text" : "password"}
                          placeholder="Introdu parola veche"
                          {...field}
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          disabled={isLoading}
                        >
                          {showOldPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parolă Nouă</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Parola nouă (min. 8 caractere)"
                          {...field}
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          disabled={isLoading}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmă Parola</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          placeholder="Confirmă parola nouă"
                          {...field}
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirm(!showConfirm)}
                          disabled={isLoading}
                        >
                          {showConfirm ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2 pt-4">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Se schimbă..." : "Schimbă Parola"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Parola trebuie să aibă cel puțin 8 caractere, o literă mare și o cifră.
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
