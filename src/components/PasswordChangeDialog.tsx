import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Introdu parola actuală"),
  newPassword: z.string()
    .min(6, "Parola trebuie să aibă minim 6 caractere"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Parolele nu se potrivesc",
  path: ["confirmPassword"]
});

interface PasswordChangeDialogProps {
  open: boolean;
  onSuccess: () => void;
}

export function PasswordChangeDialog({ open, onSuccess }: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    const validation = passwordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword
    });

    if (!validation.success) {
      const fieldErrors: { [key: string]: string } = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      // Verify current password by trying to sign in
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.email) {
        throw new Error("Nu s-a putut verifica utilizatorul");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.user.email,
        password: currentPassword
      });

      if (signInError) {
        setErrors({ currentPassword: "Parola actuală este incorectă" });
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Actualizare manuală user_password_tracking
      const { error: trackingError } = await supabase
        .from('user_password_tracking')
        .update({
          must_change_password: false,
          is_default_password: false,
          password_changed_at: new Date().toISOString()
        })
        .eq('user_id', user.user.id);

      if (trackingError) {
        console.error('Password tracking update error:', trackingError);
      }

      toast({
        title: "✅ Parola schimbată cu succes!",
        description: "Parola ta a fost actualizată.",
      });

      onSuccess();
    } catch (error) {
      console.error('Password change error:', error);
      toast({
        title: "Eroare",
        description: error instanceof Error ? error.message : "A apărut o eroare",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Schimbare Obligatorie a Parolei
          </DialogTitle>
          <DialogDescription>
            Pentru securitatea contului tău, trebuie să schimbi parola din 123456 în una personalizată (minim 6 caractere).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Parola actuală</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="123456"
              disabled={loading}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">
              Parola nouă
              <span className="text-xs text-muted-foreground ml-2">
                ({newPassword.length} caractere)
              </span>
            </Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 caractere"
              disabled={loading}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmă parola nouă</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Rescrie parola nouă"
              disabled={loading}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schimbă Parola
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
