import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if Push API is supported
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Permisiune notificări refuzată");
      }
      return true;
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut obține permisiunea pentru notificări",
        variant: "destructive",
      });
      return false;
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast({
        title: "Nu este suportat",
        description: "Notificările push nu sunt suportate în acest browser",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      // Note: In production, you would use your actual VAPID public key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          "BEl62iUYgUivxIkv69yViEuiBIa-Ib37J8xQmrVOSKSdzMM7DjKFaZpelN6gu-Hfn5gY2gCmqPnCPVW6JHFClk8"
        ),
      });

      // Save subscription to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            subscription_data: subscription.toJSON() as any,
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) throw error;

      setIsSubscribed(true);
      toast({
        title: "Succes",
        description: "Notificările push au fost activate",
      });
    } catch (error: any) {
      console.error("Error subscribing to push notifications:", error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut activa notificările push",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id);
        }

        setIsSubscribed(false);
        toast({
          title: "Dezactivat",
          description: "Notificările push au fost dezactivate",
        });
      }
    } catch (error: any) {
      console.error("Error unsubscribing:", error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut dezactiva notificările push",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
