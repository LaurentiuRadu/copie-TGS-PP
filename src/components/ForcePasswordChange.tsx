import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Eye, EyeOff, Lock } from "lucide-react";

const passwordSchema = z.object({
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

interface ForcePasswordChangeProps {
  onPasswordChanged: () => void;
}

export function ForcePasswordChange({ onPasswordChanged }: ForcePasswordChangeProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      setIsLoading(true);

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) throw updateError;

      // Update password tracking table
      const { error: trackingError } = await supabase
        .from("user_password_tracking")
        .update({
          password_changed_at: new Date().toISOString(),
          must_change_password: false,
          is_default_password: false,
        })
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      if (trackingError) throw trackingError;

      toast({
        title: "Parolă schimbată cu succes",
        description: "Parola ta a fost actualizată.",
      });

      onPasswordChanged();
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut schimba parola. Te rugăm să încerci din nou.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-primary" />
            <DialogTitle>Schimbă Parola</DialogTitle>
          </div>
          <DialogDescription>
            Pentru securitatea contului tău, trebuie să schimbi parola implicită înainte de a continua.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parolă Nouă</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Parola nouă (min. 8 caractere)"
                        {...field}
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? (
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
      </DialogContent>
    </Dialog>
  );
}
