import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_LOGOUT = 5 * 60 * 1000; // 5 minutes

export function SessionTimeoutManager() {
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    toast.error("Sesiune expirată din cauza inactivității");
    await supabase.auth.signOut();
  }, []);

  const showWarning = useCallback(() => {
    toast.warning("Sesiunea va expira în 5 minute din cauza inactivității", {
      duration: 10000,
    });
  }, []);

  const resetTimeout = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Set warning timeout
    warningRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);

    // Update session activity in database
    if (user) {
      supabase
        .from("active_sessions")
        .update({
          last_activity: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Error updating session activity:", error);
          }
        });
    }
  }, [user, logout, showWarning]);

  useEffect(() => {
    if (!user) return;

    // Activity events to track
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    // Throttle reset to avoid too many calls
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimeout) {
        resetTimeout();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 60000); // Throttle to once per minute
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledReset);
    });

    // Initial timeout setup
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [user, resetTimeout]);

  // Check for invalidated sessions
  useEffect(() => {
    if (!user) return;

    const checkSessionValidity = setInterval(async () => {
      const { data, error } = await supabase
        .from("active_sessions")
        .select("invalidated_at, expires_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking session validity:", error);
        return;
      }

      if (data) {
        // Check if session is invalidated
        if (data.invalidated_at) {
          toast.error("Sesiunea a fost invalidată. Te rugăm să te autentifici din nou.");
          await supabase.auth.signOut();
          return;
        }

        // Check if session expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          toast.error("Sesiunea a expirat. Te rugăm să te autentifici din nou.");
          await supabase.auth.signOut();
          return;
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkSessionValidity);
  }, [user]);

  return null; // This component doesn't render anything
}
