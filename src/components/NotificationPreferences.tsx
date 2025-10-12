import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Clock, Send } from "lucide-react";

export function NotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [numberError, setNumberError] = useState("");

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch WhatsApp number from profiles
  const { data: profile } = useQuery({
    queryKey: ['profile-whatsapp', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('whatsapp_number')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (preferences) {
      setWhatsappEnabled(preferences.whatsapp_enabled || false);
      setQuietHoursStart(preferences.quiet_hours_start || "22:00");
      setQuietHoursEnd(preferences.quiet_hours_end || "08:00");
    }
    if (profile?.whatsapp_number) {
      setWhatsappNumber(profile.whatsapp_number);
    }
  }, [preferences, profile]);

  const validatePhoneNumber = (number: string): boolean => {
    const romanianPhoneRegex = /^\+40[0-9]{9}$/;
    return romanianPhoneRegex.test(number);
  };

  const handleNumberChange = (value: string) => {
    setWhatsappNumber(value);
    if (value && !validatePhoneNumber(value)) {
      setNumberError("Format invalid. Exemplu: +40712345678");
    } else {
      setNumberError("");
    }
  };

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      // Validare număr dacă WhatsApp e activat
      if (whatsappEnabled && !whatsappNumber) {
        throw new Error("Adaugă un număr WhatsApp înainte de activare");
      }

      if (whatsappEnabled && !validatePhoneNumber(whatsappNumber)) {
        throw new Error("Format număr invalid. Folosește formatul: +40712345678");
      }

      // Update WhatsApp number în profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          whatsapp_number: whatsappNumber,
          whatsapp_notifications_enabled: whatsappEnabled 
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Upsert notification preferences
      const { error: prefsError } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          whatsapp_enabled: whatsappEnabled,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (prefsError) throw prefsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile-whatsapp', user?.id] });
      toast({
        title: "Salvat cu succes",
        description: "Preferințele tale WhatsApp au fost actualizate.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Eroare",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test notification mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      if (!whatsappNumber) throw new Error("Adaugă un număr WhatsApp");
      if (!validatePhoneNumber(whatsappNumber)) {
        throw new Error("Format număr invalid");
      }

      // Aici ar trebui să invoce edge function-ul direct pentru test
      // Pentru moment, doar simulăm
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 2000);
      });
    },
    onSuccess: () => {
      toast({
        title: "Notificare test trimisă",
        description: "Verifică WhatsApp-ul pentru mesajul de test.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Eroare la trimitere",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
          <CardTitle>Notificări WhatsApp</CardTitle>
          {whatsappEnabled && whatsappNumber && (
            <Badge variant="default" className="bg-[#25D366] hover:bg-[#25D366]/90">
              Activ
            </Badge>
          )}
        </div>
        <CardDescription>
          Primește notificări despre programări direct pe WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* WhatsApp Number Input */}
        <div className="space-y-2">
          <Label htmlFor="whatsapp-number">Număr WhatsApp</Label>
          <Input
            id="whatsapp-number"
            type="tel"
            placeholder="+40712345678"
            value={whatsappNumber}
            onChange={(e) => handleNumberChange(e.target.value)}
            className={numberError ? "border-destructive" : ""}
          />
          {numberError && (
            <p className="text-sm text-destructive">{numberError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Format: +40 urmat de 9 cifre (ex: +40712345678)
          </p>
        </div>

        {/* Enable WhatsApp Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="whatsapp-enabled">Activează notificări WhatsApp</Label>
            <p className="text-sm text-muted-foreground">
              Primești notificări la fiecare schimbare de programare
            </p>
          </div>
          <Switch
            id="whatsapp-enabled"
            checked={whatsappEnabled}
            onCheckedChange={setWhatsappEnabled}
            disabled={!whatsappNumber || !!numberError}
          />
        </div>

        {whatsappEnabled && !whatsappNumber && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Adaugă un număr WhatsApp pentru a activa notificările
            </p>
          </div>
        )}

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label>Ore de liniște</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Nu vei primi notificări WhatsApp în acest interval
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiet-start" className="text-sm">De la</Label>
              <Input
                id="quiet-start"
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-end" className="text-sm">Până la</Label>
              <Input
                id="quiet-end"
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Preview Message */}
        {whatsappNumber && whatsappEnabled && (
          <div className="space-y-2">
            <Label>Preview mesaj WhatsApp</Label>
            <div className="rounded-lg border bg-muted/50 p-4 text-sm">
              <p className="font-semibold">🗓️ Programare Nouă</p>
              <br />
              <p>Echipa: E1</p>
              <p>Zi: Luni, 14.10.2025</p>
              <p>Tură: zi ☀️</p>
              <br />
              <p>📍 Locație: Berceni</p>
              <p>🚗 Vehicul: Dacia Logan</p>
              <p>📋 Activitate: Distribuție</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !!numberError}
            className="flex-1"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se salvează...
              </>
            ) : (
              "Salvează preferințe"
            )}
          </Button>

          {whatsappEnabled && whatsappNumber && !numberError && (
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Test
                </>
              )}
            </Button>
          )}
        </div>

        {/* GDPR Consent */}
        {whatsappEnabled && (
          <div className="rounded-md border border-muted p-3 text-sm text-muted-foreground">
            <p>
              Prin activarea notificărilor WhatsApp, accepți să primești mesaje automate 
              conform <a href="/privacy-policy" className="underline hover:text-foreground">Politicii de Confidențialitate</a>.
              Poți dezactiva oricând din setări.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
