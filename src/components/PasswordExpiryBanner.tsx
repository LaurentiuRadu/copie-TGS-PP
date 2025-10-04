import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PasswordExpiryBanner() {
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    checkPasswordExpiry();
  }, []);

  const checkPasswordExpiry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_password_tracking")
        .select("password_changed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) return;

      const passwordChangedAt = new Date(data.password_changed_at);
      const now = new Date();
      const daysSinceChange = Math.floor(
        (now.getTime() - passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysRemaining = 90 - daysSinceChange;

      // Show banner if password expires in 14 days or less
      if (daysRemaining <= 14 && daysRemaining > 0) {
        setDaysUntilExpiry(daysRemaining);
        setShowBanner(true);
      }
    } catch (error) {
      console.error("Error checking password expiry:", error);
    }
  };

  if (!showBanner || daysUntilExpiry === null) return null;

  return (
    <Alert className="mb-4 border-yellow-500 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-500" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span className="flex-1">
          Parola ta expiră în <strong>{daysUntilExpiry} zile</strong>.{" "}
          <Link to="/change-password" className="underline font-medium hover:text-primary">
            Schimbă-o acum
          </Link>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowBanner(false)}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
